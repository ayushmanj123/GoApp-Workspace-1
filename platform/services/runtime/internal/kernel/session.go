package kernel

import (
	"context"
	"sync"
	"time"

	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/goapps-platform/runtime-service/internal/state"
	"github.com/google/uuid"
)

// Package is cached application metadata for a runtime session.
type Package struct {
	AppID         uuid.UUID
	OnStart       *string
	Screens       []RuntimeScreen
	Entities      []string
	// Connectors lists REST and SQL connector names owned by the application
	// so runtime can resolve datasource names bound to them.
	Connectors    []string
	Controls      map[string]RuntimeControl
	ScreensByName map[string]RuntimeScreen
}

// RuntimeScreen is a cached metadata screen.
type RuntimeScreen struct {
	ID        uuid.UUID
	Name      string
	OnVisible *string
}

// RuntimeControl is a cached metadata control with formulas and properties.
type RuntimeControl struct {
	ID          uuid.UUID
	Name        string
	ControlType string
	ScreenID    uuid.UUID
	Screen      string
	X           int
	Y           int
	Width       int
	Height      int
	Formulas    []RuntimeFormula
	Properties  map[string]interface{}
}

// RuntimeFormula binds an event or property to a formula expression.
type RuntimeFormula struct {
	PropertyName string
	FormulaText  string
	FormulaType  string
}

// RuntimeSession is an active application runtime session.
type RuntimeSession struct {
	ID            uuid.UUID
	AppID         uuid.UUID
	TenantID      uuid.UUID
	UserID        uuid.UUID
	Channel       string
	Package       *Package
	State         state.FormulaStateManager
	CurrentScreen string
	LastActive    time.Time
	Dependencies  []reactive.ControlDependency
}

// Touch updates the session activity timestamp.
func (s *RuntimeSession) Touch() {
	if s == nil {
		return
	}
	s.LastActive = time.Now().UTC()
}

// StartSessionRequest starts a new runtime session.
type StartSessionRequest struct {
	AppID   uuid.UUID `json:"appId"`
	Channel string    `json:"channel,omitempty"`
	Screen  string    `json:"screen,omitempty"`
}

// StartSessionResponse is returned when a runtime session is created.
type StartSessionResponse struct {
	SessionID uuid.UUID                        `json:"sessionId"`
	AppID     uuid.UUID                        `json:"appId"`
	Refresh   []reactive.RefreshInstruction  `json:"refresh,omitempty"`
}

// ControlEventRequest executes a control or screen lifecycle event.
type ControlEventRequest struct {
	AppID     uuid.UUID `json:"appId"`
	ControlID string    `json:"controlId,omitempty"`
	Event     string    `json:"event"`
	Screen    string    `json:"screen,omitempty"`
}

// ControlEventResponse returns formula execution output and refresh instructions.
type ControlEventResponse struct {
	Result        any                             `json:"result,omitempty"`
	Refresh       []reactive.RefreshInstruction `json:"refresh,omitempty"`
	CurrentScreen string                          `json:"currentScreen,omitempty"`
}

// SessionManager tracks active runtime sessions and enforces TTL expiration.
type SessionManager struct {
	mu       sync.RWMutex
	sessions map[uuid.UUID]*RuntimeSession
	ttl      time.Duration
}

func NewSessionManager(ttl time.Duration) *SessionManager {
	if ttl <= 0 {
		ttl = 30 * time.Minute
	}
	return &SessionManager{
		sessions: map[uuid.UUID]*RuntimeSession{},
		ttl:      ttl,
	}
}

func (m *SessionManager) Put(session *RuntimeSession) {
	if m == nil || session == nil {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	session.Touch()
	m.sessions[session.ID] = session
}

func (m *SessionManager) Get(sessionID uuid.UUID) (*RuntimeSession, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	session, ok := m.sessions[sessionID]
	if !ok {
		return nil, false
	}
	return session, true
}

func (m *SessionManager) Count() int {
	if m == nil {
		return 0
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.sessions)
}

func (m *SessionManager) Delete(sessionID uuid.UUID) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.sessions, sessionID)
}

func (m *SessionManager) ExpireIdle(now time.Time) []*RuntimeSession {
	m.mu.Lock()
	defer m.mu.Unlock()
	expired := make([]*RuntimeSession, 0)
	for id, session := range m.sessions {
		if now.Sub(session.LastActive) > m.ttl {
			expired = append(expired, session)
			delete(m.sessions, id)
		}
	}
	return expired
}

func (m *SessionManager) StartCleanup(ctx context.Context, registry *Registry, onExpire func(*RuntimeSession)) {
	if m == nil {
		return
	}
	ticker := time.NewTicker(time.Minute)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				for _, session := range m.ExpireIdle(now) {
					if registry != nil && registry.State != nil && session != nil {
						registry.State.DeleteSession(session.AppID, session.ID)
					}
					if onExpire != nil {
						onExpire(session)
					}
				}
			}
		}
	}()
}
