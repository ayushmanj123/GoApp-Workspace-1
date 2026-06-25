package form

import (
	"context"
	"errors"
	"strings"

	"github.com/goapps-platform/runtime-service/internal/databinding"
	"github.com/goapps-platform/runtime-service/internal/gallery"
	"github.com/goapps-platform/runtime-service/internal/records"
	"github.com/google/uuid"
)

var (
	ErrFormNotFound      = errors.New("form not found")
	ErrInvalidMode       = errors.New("invalid form mode")
	ErrValidationFailed  = errors.New("validation failed")
	ErrRecordUnavailable = errors.New("record is unavailable")
)

// RecordWriter persists entity records through the record service.
type RecordWriter interface {
	Create(ctx context.Context, tenantID, userID, entityID uuid.UUID, data map[string]interface{}) (*records.EntityRecord, error)
	Update(ctx context.Context, tenantID, userID, entityID, recordID uuid.UUID, patch map[string]interface{}, expectedVersion int) (*records.EntityRecord, error)
}

// SchemaReader loads entity schemas for validation.
type SchemaReader interface {
	GetEntitySchema(ctx context.Context, tenantID, entityID uuid.UUID) (*records.EntitySchema, error)
}

// BindingResolver resolves datasource names to entity bindings.
type BindingResolver interface {
	Resolve(ctx context.Context, tenantID, appID uuid.UUID, dataSourceName string, overrides databinding.QueryOverrides) (*databinding.ResolvedBinding, databinding.QueryInput, error)
}

// GalleryReader resolves gallery selections for form items.
type GalleryReader interface {
	GetSelected(galleryName string) (any, bool)
}

// Service manages runtime form state and persistence.
type Service struct {
	store    *SessionStore
	records  RecordWriter
	schema   SchemaReader
	resolver BindingResolver
	sources  *databinding.DataSourceRegistry
	gallery  *gallery.SessionStore
}

func NewService(
	store *SessionStore,
	records RecordWriter,
	schema SchemaReader,
	resolver BindingResolver,
	sources *databinding.DataSourceRegistry,
	galleryStore *gallery.SessionStore,
) *Service {
	return &Service{
		store:    store,
		records:  records,
		schema:   schema,
		resolver: resolver,
		sources:  sources,
		gallery:  galleryStore,
	}
}

func (s *Service) ClearSession(sessionID uuid.UUID) {
	if s == nil || s.store == nil {
		return
	}
	s.store.ClearSession(sessionID)
}

func (s *Service) Reader(sessionID uuid.UUID) *Reader {
	return NewReader(s.store, sessionID)
}

// Load initializes or returns form state for a control.
func (s *Service) Load(ctx context.Context, sessionID, tenantID, userID, appID uuid.UUID, control ControlMetadata) (*State, error) {
	if s == nil {
		return nil, ErrFormNotFound
	}
	if existing, ok := s.store.Get(sessionID, control.Name); ok {
		return existing, nil
	}
	state, err := s.buildState(ctx, sessionID, tenantID, appID, control)
	if err != nil {
		return nil, err
	}
	s.store.Set(sessionID, control.Name, state)
	return cloneState(state), nil
}

// Get returns cached form state.
func (s *Service) Get(sessionID uuid.UUID, formName string) (*State, error) {
	state, ok := s.store.Get(sessionID, formName)
	if !ok {
		return nil, ErrFormNotFound
	}
	return state, nil
}

// SetMode changes the form mode and reinitializes record state when needed.
func (s *Service) SetMode(ctx context.Context, sessionID, tenantID, appID uuid.UUID, control ControlMetadata, mode Mode) (*State, error) {
	state, err := s.ensureState(ctx, sessionID, tenantID, appID, control)
	if err != nil {
		return nil, err
	}
	switch mode {
	case ModeView, ModeEdit, ModeNew:
	default:
		return nil, ErrInvalidMode
	}
	state.Mode = mode
	state.ValidationErrors = nil
	switch mode {
	case ModeNew:
		state.CurrentRecord = map[string]interface{}{}
		state.OriginalRecord = map[string]interface{}{}
		state.DirtyFields = map[string]interface{}{}
	case ModeView, ModeEdit:
		record, err := s.resolveItemRecord(sessionID, control)
		if err != nil {
			return nil, err
		}
		state.CurrentRecord = cloneRecord(record)
		state.OriginalRecord = cloneRecord(record)
		state.DirtyFields = map[string]interface{}{}
	}
	s.inferBinding(ctx, tenantID, appID, control, state)
	s.store.Set(sessionID, control.Name, state)
	return cloneState(state), nil
}

// Update applies field changes and tracks dirty state.
func (s *Service) Update(ctx context.Context, sessionID, tenantID, appID uuid.UUID, control ControlMetadata, fields map[string]interface{}) (*State, error) {
	state, err := s.ensureState(ctx, sessionID, tenantID, appID, control)
	if err != nil {
		return nil, err
	}
	if state.Mode != ModeEdit && state.Mode != ModeNew {
		return nil, ErrInvalidMode
	}
	if state.CurrentRecord == nil {
		state.CurrentRecord = map[string]interface{}{}
	}
	if state.DirtyFields == nil {
		state.DirtyFields = map[string]interface{}{}
	}
	for key, value := range fields {
		state.CurrentRecord[key] = value
		state.DirtyFields[key] = value
	}
	state.ValidationErrors = s.validateState(ctx, tenantID, state)
	s.store.Set(sessionID, control.Name, state)
	return cloneState(state), nil
}

// Reset restores the original record and clears dirty state.
func (s *Service) Reset(ctx context.Context, sessionID, tenantID, appID uuid.UUID, control ControlMetadata) (*State, error) {
	state, err := s.ensureState(ctx, sessionID, tenantID, appID, control)
	if err != nil {
		return nil, err
	}
	state.CurrentRecord = cloneRecord(state.OriginalRecord)
	state.DirtyFields = map[string]interface{}{}
	state.ValidationErrors = nil
	s.store.Set(sessionID, control.Name, state)
	return cloneState(state), nil
}

// Submit persists the current record using RecordService.
func (s *Service) Submit(ctx context.Context, sessionID, tenantID, userID, appID uuid.UUID, control ControlMetadata) (*State, string, error) {
	state, err := s.ensureState(ctx, sessionID, tenantID, appID, control)
	if err != nil {
		return nil, "", err
	}
	if state.Mode != ModeEdit && state.Mode != ModeNew {
		return nil, "", ErrInvalidMode
	}
	state.ValidationErrors = s.validateState(ctx, tenantID, state)
	if len(state.ValidationErrors) > 0 {
		s.store.Set(sessionID, control.Name, state)
		return cloneState(state), "", ErrValidationFailed
	}
	if state.EntityID == uuid.Nil {
		return nil, "", ErrRecordUnavailable
	}

	payload := submissionPayload(state)
	var dataSourceName string
	switch state.Mode {
	case ModeEdit:
		recordID, version, err := recordIdentity(state.CurrentRecord)
		if err != nil {
			return nil, "", err
		}
		updated, err := s.records.Update(ctx, tenantID, userID, state.EntityID, recordID, payload, version)
		if err != nil {
			return nil, "", err
		}
		state.CurrentRecord = recordToMap(updated)
		state.OriginalRecord = cloneRecord(state.CurrentRecord)
		state.DirtyFields = map[string]interface{}{}
		state.Mode = ModeView
		dataSourceName = state.DataSource
	case ModeNew:
		created, err := s.records.Create(ctx, tenantID, userID, state.EntityID, payload)
		if err != nil {
			return nil, "", err
		}
		state.CurrentRecord = recordToMap(created)
		state.OriginalRecord = cloneRecord(state.CurrentRecord)
		state.DirtyFields = map[string]interface{}{}
		state.Mode = ModeView
		dataSourceName = state.DataSource
	default:
		return nil, "", ErrInvalidMode
	}
	state.ValidationErrors = nil
	s.store.Set(sessionID, control.Name, state)
	return cloneState(state), dataSourceName, nil
}

// SyncGallerySelection updates forms bound to a gallery selection.
func (s *Service) SyncGallerySelection(sessionID uuid.UUID, galleryName string, controls []ControlMetadata) []string {
	if s == nil || s.gallery == nil {
		return nil
	}
	reader := gallery.NewReader(s.gallery, sessionID)
	selected, ok := reader.GetSelected(galleryName)
	if !ok {
		return nil
	}
	record, ok := selected.(map[string]interface{})
	if !ok {
		return nil
	}
	updated := make([]string, 0)
	for _, control := range controls {
		if !IsFormControl(control.ControlType) {
			continue
		}
		itemFormula := ReadItemFormula(control.Formulas, control.Properties)
		refGallery, isGalleryRef := parseGallerySelectedReference(itemFormula)
		if !isGalleryRef || !strings.EqualFold(refGallery, galleryName) {
			continue
		}
		state, ok := s.store.Get(sessionID, control.Name)
		if !ok {
			state = &State{
				Mode:           ReadModeProperty(control.Properties),
				ItemFormula:    itemFormula,
				GalleryName:    galleryName,
				DirtyFields:    map[string]interface{}{},
				ValidationErrors: nil,
			}
		}
		state.CurrentRecord = cloneRecord(record)
		state.OriginalRecord = cloneRecord(record)
		state.DirtyFields = map[string]interface{}{}
		state.ValidationErrors = nil
		state.GalleryName = galleryName
		s.store.Set(sessionID, control.Name, state)
		updated = append(updated, control.Name)
	}
	return updated
}

func (s *Service) ensureState(ctx context.Context, sessionID, tenantID, appID uuid.UUID, control ControlMetadata) (*State, error) {
	if state, ok := s.store.Get(sessionID, control.Name); ok {
		return state, nil
	}
	return s.buildState(ctx, sessionID, tenantID, appID, control)
}

func (s *Service) buildState(ctx context.Context, sessionID, tenantID, appID uuid.UUID, control ControlMetadata) (*State, error) {
	itemFormula := ReadItemFormula(control.Formulas, control.Properties)
	state := &State{
		Mode:             ReadModeProperty(control.Properties),
		ItemFormula:      itemFormula,
		DirtyFields:      map[string]interface{}{},
		ValidationErrors: nil,
		DataSource:       ReadDataSource(control.Properties),
	}
	if galleryName, ok := parseGallerySelectedReference(itemFormula); ok {
		state.GalleryName = galleryName
	}
	record, err := s.resolveItemRecord(sessionID, control)
	if err != nil && state.Mode != ModeNew {
		return nil, err
	}
	if record != nil {
		state.CurrentRecord = cloneRecord(record)
		state.OriginalRecord = cloneRecord(record)
	} else if state.Mode == ModeNew {
		state.CurrentRecord = map[string]interface{}{}
		state.OriginalRecord = map[string]interface{}{}
	}
	s.inferBinding(ctx, tenantID, appID, control, state)
	return state, nil
}

func (s *Service) resolveItemRecord(sessionID uuid.UUID, control ControlMetadata) (map[string]interface{}, error) {
	itemFormula := ReadItemFormula(control.Formulas, control.Properties)
	if itemFormula == "" {
		return nil, ErrRecordUnavailable
	}
	if galleryName, ok := parseGallerySelectedReference(itemFormula); ok {
		if s.gallery == nil {
			return nil, ErrRecordUnavailable
		}
		reader := gallery.NewReader(s.gallery, sessionID)
		selected, ok := reader.GetSelected(galleryName)
		if !ok {
			return map[string]interface{}{}, nil
		}
		record, ok := selected.(map[string]interface{})
		if !ok {
			return nil, ErrRecordUnavailable
		}
		return cloneRecord(record), nil
	}
	return map[string]interface{}{}, nil
}

func (s *Service) inferBinding(ctx context.Context, tenantID, appID uuid.UUID, control ControlMetadata, state *State) {
	if state == nil {
		return
	}
	if entityID, ok := parseUUIDValue(state.CurrentRecord["entityId"]); ok {
		state.EntityID = entityID
	}
	if state.DataSource == "" {
		state.DataSource = ReadDataSource(control.Properties)
	}
	if state.DataSource == "" || s.resolver == nil {
		return
	}
	binding, _, err := s.resolver.Resolve(ctx, tenantID, appID, state.DataSource, databinding.QueryOverrides{})
	if err != nil {
		return
	}
	state.EntityID = binding.EntityID
	if state.DataSource == "" {
		state.DataSource = binding.Name
	}
}

func (s *Service) validateState(ctx context.Context, tenantID uuid.UUID, state *State) []ValidationIssue {
	if state == nil || state.EntityID == uuid.Nil || s.schema == nil {
		return nil
	}
	schema, err := s.schema.GetEntitySchema(ctx, tenantID, state.EntityID)
	if err != nil {
		return []ValidationIssue{{Message: err.Error()}}
	}
	payload := submissionPayload(state)
	var validateErr error
	if state.Mode == ModeNew {
		validateErr = records.ValidateCreateData(schema, payload)
	} else {
		validateErr = records.ValidateUpdateData(schema, payload)
	}
	if validateErr == nil {
		return nil
	}
	return validationIssuesFromError(validateErr)
}

func validationIssuesFromError(err error) []ValidationIssue {
	issues := make([]ValidationIssue, 0)
	var validationErr *records.ValidationError
	if errors.As(err, &validationErr) {
		issues = append(issues, ValidationIssue{Field: validationErr.Field, Message: validationErr.Message})
		return issues
	}
	issues = append(issues, ValidationIssue{Message: err.Error()})
	return issues
}

func submissionPayload(state *State) map[string]interface{} {
	payload := map[string]interface{}{}
	for key, value := range state.CurrentRecord {
		switch key {
		case "recordId", "entityId", "version":
			continue
		default:
			payload[key] = value
		}
	}
	return payload
}

func recordIdentity(record map[string]interface{}) (uuid.UUID, int, error) {
	if record == nil {
		return uuid.Nil, 0, ErrRecordUnavailable
	}
	recordID, ok := parseUUIDValue(record["recordId"])
	if !ok {
		return uuid.Nil, 0, ErrRecordUnavailable
	}
	version := 0
	switch typed := record["version"].(type) {
	case float64:
		version = int(typed)
	case int:
		version = typed
	case int64:
		version = int(typed)
	default:
		return uuid.Nil, 0, ErrRecordUnavailable
	}
	return recordID, version, nil
}

func recordToMap(record *records.EntityRecord) map[string]interface{} {
	if record == nil {
		return map[string]interface{}{}
	}
	data := cloneRecord(record.Data)
	data["recordId"] = record.ID.String()
	data["entityId"] = record.EntityID.String()
	data["version"] = record.Version
	return data
}

func parseUUIDValue(value interface{}) (uuid.UUID, bool) {
	switch typed := value.(type) {
	case string:
		id, err := uuid.Parse(strings.TrimSpace(typed))
		return id, err == nil
	case uuid.UUID:
		return typed, typed != uuid.Nil
	default:
		return uuid.Nil, false
	}
}
