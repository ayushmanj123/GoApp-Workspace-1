package gallery

import (
	"sync"

	"github.com/google/uuid"
)

// State holds resolved gallery rows and the current selection for one control.
type State struct {
	Items    []map[string]interface{}
	Selected map[string]interface{}
	Source   string
}

// SessionStore tracks gallery state per runtime session.
type SessionStore struct {
	mu       sync.RWMutex
	sessions map[uuid.UUID]map[string]*State
}

func NewSessionStore() *SessionStore {
	return &SessionStore{
		sessions: map[uuid.UUID]map[string]*State{},
	}
}

func (s *SessionStore) Get(sessionID uuid.UUID, galleryName string) (*State, bool) {
	if s == nil {
		return nil, false
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	galleries, ok := s.sessions[sessionID]
	if !ok {
		return nil, false
	}
	state, ok := galleries[normalizeName(galleryName)]
	if !ok || state == nil {
		return nil, false
	}
	return cloneState(state), true
}

func (s *SessionStore) Set(sessionID uuid.UUID, galleryName string, state *State) {
	if s == nil || state == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	galleries, ok := s.sessions[sessionID]
	if !ok {
		galleries = map[string]*State{}
		s.sessions[sessionID] = galleries
	}
	galleries[normalizeName(galleryName)] = cloneState(state)
}

func (s *SessionStore) Select(sessionID uuid.UUID, galleryName string, selected map[string]interface{}) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	galleries, ok := s.sessions[sessionID]
	if !ok {
		return
	}
	state, ok := galleries[normalizeName(galleryName)]
	if !ok || state == nil {
		return
	}
	if selected == nil {
		state.Selected = nil
		return
	}
	state.Selected = cloneRecord(selected)
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
		Source: state.Source,
		Items:  make([]map[string]interface{}, 0, len(state.Items)),
	}
	for _, item := range state.Items {
		cloned.Items = append(cloned.Items, cloneRecord(item))
	}
	if state.Selected != nil {
		cloned.Selected = cloneRecord(state.Selected)
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
