// Package state provides in-memory runtime state for variables, collections, and screen context.
package state

import (
	"errors"

	"github.com/google/uuid"
)

var (
	ErrSessionNotFound  = errors.New("session not found")
	ErrVariableNotFound = errors.New("variable not found")
	ErrInvalidRequest   = errors.New("invalid request")
)

// SessionKey uniquely identifies runtime state for an application session.
type SessionKey struct {
	AppID     uuid.UUID
	SessionID uuid.UUID
}

// RuntimeState is a point-in-time snapshot of session state.
type RuntimeState struct {
	AppID            uuid.UUID                  `json:"appId"`
	SessionID        uuid.UUID                  `json:"sessionId"`
	GlobalVariables  map[string]any             `json:"globalVariables"`
	ContextVariables map[string]map[string]any  `json:"contextVariables"`
	Collections      map[string][]any           `json:"collections"`
}

// StateManager provides thread-safe access to runtime session state.
type StateManager interface {
	GetVariable(name string) (any, bool)
	SetVariable(name string, value any)

	GetContext(screen, name string) (any, bool)
	SetContext(screen, name string, value any)

	GetCollection(name string) []any
	SetCollection(name string, items []any)
	ClearCollection(name string)

	Snapshot() RuntimeState
}

// FormulaStateManager extends StateManager with operations the formula engine will call later.
type FormulaStateManager interface {
	StateManager

	UpdateVariable(name string, value any) error
	DeleteVariable(name string) error

	Collect(collection string, item any)
	Clear(collection string)
	ClearCollect(collection string, items []any)
	First(collection string) (any, bool)
	Last(collection string) (any, bool)
	CountRows(collection string) int

	UpdateContext(screen string, values map[string]any)
}

// CreateSessionRequest starts a new runtime session for an application.
type CreateSessionRequest struct {
	AppID uuid.UUID `json:"appId"`
}

// CreateSessionResponse returns the generated session identifier.
type CreateSessionResponse struct {
	SessionID uuid.UUID `json:"sessionId"`
	AppID     uuid.UUID `json:"appId"`
}

// SetVariableRequest sets or updates a global variable.
type SetVariableRequest struct {
	AppID uuid.UUID `json:"appId"`
	Name  string    `json:"name"`
	Value any       `json:"value"`
}

// CollectionActionRequest mutates a named collection.
type CollectionActionRequest struct {
	AppID  uuid.UUID `json:"appId"`
	Name   string    `json:"name"`
	Action string    `json:"action"`
	Item   any       `json:"item,omitempty"`
	Items  []any     `json:"items,omitempty"`
}

// UpdateContextRequest merges screen-scoped context variables.
type UpdateContextRequest struct {
	AppID  uuid.UUID      `json:"appId"`
	Values map[string]any `json:"values"`
}
