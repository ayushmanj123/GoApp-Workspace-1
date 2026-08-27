package form

import (
	"sync"

	"github.com/google/uuid"
)

// Mode identifies the runtime form editing state.
type Mode string

const (
	ModeView Mode = "View"
	ModeEdit Mode = "Edit"
	ModeNew  Mode = "New"
)

// ValidationIssue is a structured field validation error.
type ValidationIssue struct {
	Field   string `json:"field,omitempty"`
	Message string `json:"message"`
}

// State is the runtime state for a single form control.
type State struct {
	Mode             Mode
	CurrentRecord    map[string]interface{}
	OriginalRecord   map[string]interface{}
	DirtyFields      map[string]interface{}
	ValidationErrors []ValidationIssue
	LastSubmit       map[string]interface{}
	LastError        *FormError
	DataSource       string
	DataSourceKind   string
	EntityID         uuid.UUID
	TenantID         uuid.UUID
	ItemFormula      string
	GalleryName      string
	RequiredColumns  []string
}

// FormError captures the last submit/update failure for Form.Error.
type FormError struct {
	Message string             `json:"message"`
	Issues  []ValidationIssue  `json:"issues,omitempty"`
}

// SessionStore tracks form state per runtime session.
type SessionStore struct {
	mu       sync.RWMutex
	sessions map[uuid.UUID]map[string]*State
}

func NewSessionStore() *SessionStore {
	return &SessionStore{sessions: map[uuid.UUID]map[string]*State{}}
}

func (s *SessionStore) Get(sessionID uuid.UUID, formName string) (*State, bool) {
	if s == nil {
		return nil, false
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	forms, ok := s.sessions[sessionID]
	if !ok {
		return nil, false
	}
	state, ok := forms[normalizeName(formName)]
	if !ok || state == nil {
		return nil, false
	}
	return cloneState(state), true
}

func (s *SessionStore) Set(sessionID uuid.UUID, formName string, state *State) {
	if s == nil || state == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	forms, ok := s.sessions[sessionID]
	if !ok {
		forms = map[string]*State{}
		s.sessions[sessionID] = forms
	}
	forms[normalizeName(formName)] = cloneState(state)
}

func (s *SessionStore) ClearSession(sessionID uuid.UUID) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, sessionID)
}

func cloneState(state *State) *State {
	if state == nil {
		return nil
	}
	cloned := &State{
		Mode:             state.Mode,
		DataSource:       state.DataSource,
		DataSourceKind:   state.DataSourceKind,
		EntityID:         state.EntityID,
		TenantID:         state.TenantID,
		ItemFormula:      state.ItemFormula,
		GalleryName:      state.GalleryName,
		RequiredColumns:  append([]string(nil), state.RequiredColumns...),
		CurrentRecord:    cloneRecord(state.CurrentRecord),
		OriginalRecord:   cloneRecord(state.OriginalRecord),
		DirtyFields:      cloneRecord(state.DirtyFields),
		LastSubmit:       cloneRecord(state.LastSubmit),
		ValidationErrors: append([]ValidationIssue(nil), state.ValidationErrors...),
	}
	if state.LastError != nil {
		cloned.LastError = &FormError{
			Message: state.LastError.Message,
			Issues:  append([]ValidationIssue(nil), state.LastError.Issues...),
		}
	}
	return cloned
}

func cloneRecord(record map[string]interface{}) map[string]interface{} {
	if record == nil {
		return nil
	}
	cloned := make(map[string]interface{}, len(record))
	for key, value := range record {
		cloned[key] = value
	}
	return cloned
}

func normalizeName(name string) string {
	return stringsTrimSpace(name)
}
