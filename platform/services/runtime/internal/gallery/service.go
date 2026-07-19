package gallery

import (
	"context"
	"errors"
	"strings"

	"github.com/goapps-platform/runtime-service/internal/databinding"
	"github.com/goapps-platform/runtime-service/internal/state"
	"github.com/google/uuid"
)

var (
	ErrGalleryNotFound = errors.New("gallery not found")
	ErrInvalidSelect   = errors.New("invalid gallery selection")
)

// BindingResolver resolves entity datasource names.
type BindingResolver interface {
	Resolve(ctx context.Context, tenantID, appID uuid.UUID, dataSourceName string, overrides databinding.QueryOverrides) (*databinding.ResolvedBinding, databinding.QueryInput, error)
}

// DataSourceQuerier executes datasource queries.
type DataSourceQuerier interface {
	QueryDataSource(ctx context.Context, tenantID, userID, appID uuid.UUID, dataSourceName string, overrides databinding.QueryOverrides) (*databinding.QueryResult, error)
}

// Service resolves gallery items, maintains selection, and exposes runtime state.
type Service struct {
	store    *SessionStore
	querier  DataSourceQuerier
	resolver BindingResolver
}

func NewService(store *SessionStore, querier DataSourceQuerier, resolver BindingResolver) *Service {
	return &Service{
		store:    store,
		querier:  querier,
		resolver: resolver,
	}
}

func (s *Service) ClearSession(sessionID uuid.UUID) {
	if s == nil || s.store == nil {
		return
	}
	s.store.ClearSession(sessionID)
}

func (s *Service) Reader(sessionID uuid.UUID) *Reader {
	if s == nil || s.store == nil {
		return nil
	}
	return NewReader(s.store, sessionID)
}

// Load resolves and caches gallery items for a control.
func (s *Service) Load(ctx context.Context, sessionID, tenantID, userID, appID uuid.UUID, control ControlMetadata) (*State, error) {
	if s == nil {
		return nil, ErrGalleryNotFound
	}
	source := ReadItemsFormula(control.Formulas, control.Properties)
	filter := ReadFilterFormula(control.Formulas, control.Properties)
	sort := ReadSortFormula(control.Formulas, control.Properties)
	limit := ReadLimitProperty(control.Formulas, control.Properties)
	pageSize := ReadPageSizeProperty(control.Formulas, control.Properties)
	offset := ReadOffsetProperty(control.Formulas, control.Properties)
	state := &State{
		Source: source,
		Items:  []map[string]interface{}{},
	}
	if source != "" {
		items, err := s.resolveItems(ctx, tenantID, userID, appID, source, filter, sort, limit, pageSize, offset, control.EntityNames, nil)
		if err != nil {
			return nil, err
		}
		state.Items = items
	}
	s.store.Set(sessionID, control.Name, state)
	return cloneState(state), nil
}

// Get returns cached gallery state.
func (s *Service) Get(sessionID uuid.UUID, galleryName string) (*State, error) {
	state, ok := s.store.Get(sessionID, galleryName)
	if !ok {
		return nil, ErrGalleryNotFound
	}
	return state, nil
}

// Select updates the selected gallery row and returns the selected record.
func (s *Service) Select(sessionID uuid.UUID, galleryName string, index int) (map[string]interface{}, error) {
	state, ok := s.store.Get(sessionID, galleryName)
	if !ok {
		return nil, ErrGalleryNotFound
	}
	if index < 0 || index >= len(state.Items) {
		return nil, ErrInvalidSelect
	}
	selected := cloneRecord(state.Items[index])
	s.store.Select(sessionID, galleryName, selected)
	return selected, nil
}

// ReloadForSource refreshes galleries bound to a datasource or collection name.
func (s *Service) ReloadForSource(ctx context.Context, sessionID, tenantID, userID, appID uuid.UUID, source string, controls []ControlMetadata, stateManager state.FormulaStateManager) ([]string, error) {
	source = stringsTrimSpace(source)
	if source == "" {
		return nil, nil
	}
	reloaded := make([]string, 0)
	for _, control := range controls {
		if !IsItemsControl(control.ControlType) {
			continue
		}
		itemsSource := ReadItemsFormula(control.Formulas, control.Properties)
		if !stringsEqualFold(itemsSource, source) {
			continue
		}
		filter := ReadFilterFormula(control.Formulas, control.Properties)
		sort := ReadSortFormula(control.Formulas, control.Properties)
		limit := ReadLimitProperty(control.Formulas, control.Properties)
		pageSize := ReadPageSizeProperty(control.Formulas, control.Properties)
		offset := ReadOffsetProperty(control.Formulas, control.Properties)
		items, err := s.resolveItems(ctx, tenantID, userID, appID, itemsSource, filter, sort, limit, pageSize, offset, control.EntityNames, stateManager)
		if err != nil {
			return reloaded, err
		}
		current, _ := s.store.Get(sessionID, control.Name)
		next := &State{
			Source: itemsSource,
			Items:  items,
		}
		if current != nil && current.Selected != nil {
			if matched := matchSelected(items, current.Selected); matched != nil {
				next.Selected = matched
			}
		}
		s.store.Set(sessionID, control.Name, next)
		reloaded = append(reloaded, control.Name)
	}
	return reloaded, nil
}

func (s *Service) resolveItems(
	ctx context.Context,
	tenantID, userID, appID uuid.UUID,
	source string,
	filter string,
	sort string,
	limit int,
	pageSize int,
	offset int,
	entities []string,
	stateManager state.FormulaStateManager,
) ([]map[string]interface{}, error) {
	source = stringsTrimSpace(source)
	if source == "" {
		return []map[string]interface{}{}, nil
	}
	if isEntitySource(source, entities) {
		if s.querier == nil {
			return nil, errors.New("datasource querier is unavailable")
		}
		overrides := databinding.QueryOverrides{
			Filter: stringsTrimSpace(filter),
			Sort:   stringsTrimSpace(sort),
		}
		effectiveLimit := limit
		if pageSize > 0 {
			effectiveLimit = pageSize
		}
		if effectiveLimit > 0 {
			overrides.Limit = effectiveLimit
		}
		if offset > 0 {
			overrides.Offset = offset
		}
		result, err := s.querier.QueryDataSource(ctx, tenantID, userID, appID, source, overrides)
		if err != nil {
			return nil, err
		}
		items := make([]map[string]interface{}, 0, len(result.Items))
		for _, item := range result.Items {
			items = append(items, cloneRecord(item))
		}
		return items, nil
	}
	if stateManager != nil {
		collection := stateManager.GetCollection(source)
		items := make([]map[string]interface{}, 0, len(collection))
		for _, item := range collection {
			if record, ok := item.(map[string]interface{}); ok {
				items = append(items, cloneRecord(record))
				continue
			}
			items = append(items, map[string]interface{}{"Value": item})
		}
		filter = stringsTrimSpace(filter)
		if filter != "" {
			expr, err := databinding.ParseFilterExpr(filter)
			if err != nil {
				return nil, err
			}
			filtered := make([]map[string]interface{}, 0, len(items))
			for _, item := range items {
				if databinding.MatchFilterExpr(item, expr) {
					filtered = append(filtered, item)
				}
			}
			items = filtered
		}
		if limit > 0 && len(items) > limit {
			items = items[:limit]
		}
		if pageSize > 0 && len(items) > pageSize {
			items = items[:pageSize]
		}
		return items, nil
	}
	return []map[string]interface{}{}, nil
}

func matchSelected(items []map[string]interface{}, selected map[string]interface{}) map[string]interface{} {
	for _, item := range items {
		if recordsEqual(item, selected) {
			return cloneRecord(item)
		}
	}
	return nil
}

func recordsEqual(left, right map[string]interface{}) bool {
	if len(left) != len(right) {
		return false
	}
	for key, value := range left {
		if rightValue, ok := right[key]; !ok || rightValue != value {
			return false
		}
	}
	return true
}

func stringsEqualFold(left, right string) bool {
	return stringsTrimSpace(left) == stringsTrimSpace(right) ||
		strings.EqualFold(stringsTrimSpace(left), stringsTrimSpace(right))
}

// Reader exposes gallery state to the formula runtime.
type Reader struct {
	store     *SessionStore
	sessionID uuid.UUID
}

func NewReader(store *SessionStore, sessionID uuid.UUID) *Reader {
	return &Reader{store: store, sessionID: sessionID}
}

func (r *Reader) GetItems(galleryName string) []any {
	if r == nil || r.store == nil {
		return nil
	}
	state, ok := r.store.Get(r.sessionID, galleryName)
	if !ok || state == nil {
		return nil
	}
	items := make([]any, 0, len(state.Items))
	for _, item := range state.Items {
		items = append(items, cloneRecord(item))
	}
	return items
}

func (r *Reader) GetSelected(galleryName string) (any, bool) {
	if r == nil || r.store == nil {
		return nil, false
	}
	state, ok := r.store.Get(r.sessionID, galleryName)
	if !ok || state == nil || state.Selected == nil {
		return nil, true
	}
	return cloneRecord(state.Selected), true
}

func (r *Reader) ResolveReference(reference string) (any, bool) {
	reference = stringsTrimSpace(reference)
	if reference == "" {
		return nil, false
	}
	parts := splitReference(reference)
	if len(parts) != 2 {
		return nil, false
	}
	switch parts[1] {
	case "Selected":
		return r.GetSelected(parts[0])
	case "AllItems":
		items := r.GetItems(parts[0])
		if items == nil {
			return []any{}, true
		}
		return items, true
	default:
		return nil, false
	}
}

func splitReference(reference string) []string {
	for index, r := range reference {
		if r == '.' {
			return []string{reference[:index], reference[index+1:]}
		}
	}
	return []string{reference}
}
