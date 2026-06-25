package state

import (
	"sync"

	"github.com/google/uuid"
)

type sessionState struct {
	mu               sync.RWMutex
	globalVariables  map[string]any
	contextVariables map[string]map[string]any
	collections      map[string][]any
}

func newSessionState() *sessionState {
	return &sessionState{
		globalVariables:  map[string]any{},
		contextVariables: map[string]map[string]any{},
		collections:      map[string][]any{},
	}
}

// MemoryStore holds in-memory runtime state keyed by application and session.
type MemoryStore struct {
	mu       sync.RWMutex
	sessions map[SessionKey]*sessionState
}

// NewMemoryStore creates an empty in-memory runtime state store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		sessions: map[SessionKey]*sessionState{},
	}
}

// CreateSession generates a new session identifier and initializes isolated state.
func (s *MemoryStore) CreateSession(appID uuid.UUID) uuid.UUID {
	sessionID := uuid.New()
	key := SessionKey{AppID: appID, SessionID: sessionID}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[key] = newSessionState()
	return sessionID
}

// GetManager returns a state manager for an existing session.
func (s *MemoryStore) GetManager(appID, sessionID uuid.UUID) (FormulaStateManager, error) {
	s.mu.RLock()
	state, ok := s.sessions[SessionKey{AppID: appID, SessionID: sessionID}]
	s.mu.RUnlock()
	if !ok {
		return nil, ErrSessionNotFound
	}
	return &memoryStateManager{
		appID:     appID,
		sessionID: sessionID,
		state:     state,
	}, nil
}

// DeleteSession removes a session and its state from memory.
func (s *MemoryStore) DeleteSession(appID, sessionID uuid.UUID) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, SessionKey{AppID: appID, SessionID: sessionID})
}
