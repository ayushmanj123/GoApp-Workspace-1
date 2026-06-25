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
	DataSource       string
	EntityID         uuid.UUID
	ItemFormula      string
	GalleryName      string
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
		EntityID:         state.EntityID,
		ItemFormula:      state.ItemFormula,
		GalleryName:      state.GalleryName,
		CurrentRecord:    cloneRecord(state.CurrentRecord),
		OriginalRecord:   cloneRecord(state.OriginalRecord),
		DirtyFields:      cloneRecord(state.DirtyFields),
		ValidationErrors: append([]ValidationIssue(nil), state.ValidationErrors...),
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
