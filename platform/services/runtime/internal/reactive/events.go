// Package reactive provides an in-memory event bus and refresh engine for runtime controls.
package reactive

import (
	"time"

	"github.com/google/uuid"
)

// EventType identifies runtime reactive events.
type EventType string

const (
	EventVariableChanged    EventType = "VariableChanged"
	EventCollectionChanged  EventType = "CollectionChanged"
	EventContextChanged     EventType = "ContextChanged"
	EventDatasourceChanged  EventType = "DatasourceChanged"
	EventNavigationRequested EventType = "NavigationRequested"
	EventFormulaExecuted    EventType = "FormulaExecuted"
	EventGallerySelectionChanged EventType = "GallerySelectionChanged"
	EventFormChanged             EventType = "FormChanged"
)

// Event is a session-scoped runtime notification.
type Event struct {
	Sequence  int64          `json:"sequence"`
	SessionID uuid.UUID      `json:"sessionId"`
	AppID     uuid.UUID      `json:"appId"`
	Type      EventType      `json:"type"`
	Payload   map[string]any `json:"payload,omitempty"`
	Timestamp time.Time      `json:"timestamp"`
}

// ControlDependency describes what runtime data a control depends on.
type ControlDependency struct {
	ControlID   string   `json:"controlId"`
	Screen      string   `json:"screen,omitempty"`
	Variables   []string `json:"variables,omitempty"`
	Collections []string `json:"collections,omitempty"`
	DataSources []string `json:"dataSources,omitempty"`
	ContextKeys []string `json:"contextKeys,omitempty"`
	Galleries   []string `json:"galleries,omitempty"`
	Forms       []string `json:"forms,omitempty"`
}

// RefreshInstruction tells the client which control to refresh and why.
type RefreshInstruction struct {
	ControlID string `json:"controlId"`
	Reason    string `json:"reason"`
}

// RefreshResponse contains targeted refresh instructions.
type RefreshResponse struct {
	Refresh []RefreshInstruction `json:"refresh"`
}

// QueuedNotification is an event plus refresh instructions for polling clients.
type QueuedNotification struct {
	Event   Event                `json:"event"`
	Refresh []RefreshInstruction `json:"refresh"`
}

// PollResponse is returned by GET /api/runtime/events/poll/{sessionId}.
type PollResponse struct {
	Events []QueuedNotification `json:"events"`
}

// SubscribeRequest registers control dependencies for a session.
type SubscribeRequest struct {
	AppID     uuid.UUID           `json:"appId"`
	SessionID uuid.UUID           `json:"sessionId"`
	Controls  []ControlDependency `json:"controls"`
}

// PublishRequest manually publishes a runtime event.
type PublishRequest struct {
	AppID     uuid.UUID      `json:"appId"`
	SessionID uuid.UUID      `json:"sessionId"`
	Type      EventType      `json:"type"`
	Payload   map[string]any `json:"payload,omitempty"`
}

// PublishResponse includes refresh instructions for the published event.
type PublishResponse struct {
	Event   Event                `json:"event"`
	Refresh []RefreshInstruction `json:"refresh"`
}
