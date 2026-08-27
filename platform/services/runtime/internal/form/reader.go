package form

import (
	"context"
	"strings"

	"github.com/google/uuid"
)

// Reader exposes form state to the formula runtime.
type Reader struct {
	store     *SessionStore
	sessionID uuid.UUID
	service   *Service
}

func NewReader(store *SessionStore, sessionID uuid.UUID) *Reader {
	return &Reader{store: store, sessionID: sessionID}
}

func NewReaderWithService(store *SessionStore, sessionID uuid.UUID, service *Service) *Reader {
	return &Reader{store: store, sessionID: sessionID, service: service}
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
	state, ok := r.store.Get(r.sessionID, parts[0])
	if !ok || state == nil {
		return nil, false
	}
	switch parts[1] {
	case "Mode":
		return string(state.Mode), true
	case "Valid":
		if r.service != nil && state.TenantID != uuid.Nil {
			state = r.service.refreshValidation(context.Background(), r.sessionID, state.TenantID, parts[0])
			if state == nil {
				return true, true
			}
		}
		return len(state.ValidationErrors) == 0, true
	case "Unsaved":
		return len(state.DirtyFields) > 0, true
	case "Item":
		if state.CurrentRecord == nil {
			return map[string]interface{}{}, true
		}
		return cloneRecord(state.CurrentRecord), true
	case "Updates":
		if state.DirtyFields == nil {
			return map[string]interface{}{}, true
		}
		return cloneRecord(state.DirtyFields), true
	case "LastSubmit":
		if state.LastSubmit == nil {
			return map[string]interface{}{}, true
		}
		return cloneRecord(state.LastSubmit), true
	case "Error":
		if state.LastError == nil {
			return nil, true
		}
		return map[string]interface{}{
			"message": state.LastError.Message,
			"issues":  state.LastError.Issues,
		}, true
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

// Runtime exposes imperative form actions to the formula dispatcher.
type Runtime struct {
	service   *Service
	sessionID uuid.UUID
	tenantID  uuid.UUID
	userID    uuid.UUID
	appID     uuid.UUID
	controls  func() []ControlMetadata
}

func NewRuntime(service *Service, sessionID, tenantID, userID, appID uuid.UUID, controls func() []ControlMetadata) *Runtime {
	return &Runtime{
		service:   service,
		sessionID: sessionID,
		tenantID:  tenantID,
		userID:    userID,
		appID:     appID,
		controls:  controls,
	}
}

func (r *Runtime) SubmitForm(ctx context.Context, formName string) (string, error) {
	control, ok := r.findControl(formName)
	if !ok {
		return "", ErrFormNotFound
	}
	_, dataSource, err := r.service.Submit(ctx, r.sessionID, r.tenantID, r.userID, r.appID, control)
	return dataSource, err
}

func (r *Runtime) ResetForm(ctx context.Context, formName string) error {
	control, ok := r.findControl(formName)
	if !ok {
		return ErrFormNotFound
	}
	_, err := r.service.Reset(ctx, r.sessionID, r.tenantID, r.appID, control)
	return err
}

func (r *Runtime) SetMode(ctx context.Context, formName string, mode Mode) error {
	control, ok := r.findControl(formName)
	if !ok {
		return ErrFormNotFound
	}
	_, err := r.service.SetMode(ctx, r.sessionID, r.tenantID, r.appID, control, mode)
	return err
}

func (r *Runtime) findControl(formName string) (ControlMetadata, bool) {
	if r == nil || r.controls == nil {
		return ControlMetadata{}, false
	}
	for _, control := range r.controls() {
		if strings.EqualFold(control.Name, formName) {
			return control, true
		}
	}
	return ControlMetadata{}, false
}
