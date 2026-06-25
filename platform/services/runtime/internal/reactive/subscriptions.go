package reactive

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

// EventBus is a thread-safe in-memory pub/sub bus.
type EventBus interface {
	Publish(event Event) QueuedNotification
	Subscribe(sessionID uuid.UUID, controls []ControlDependency) string
	Unsubscribe(subscriptionID string)
	Poll(sessionID uuid.UUID) []QueuedNotification
}

type subscription struct {
	id        string
	sessionID uuid.UUID
}

type sessionState struct {
	controls      []ControlDependency
	subscriptions map[string]struct{}
	queue         []QueuedNotification
}

// Dispatcher implements EventBus with per-session queues and subscriptions.
type Dispatcher struct {
	mu            sync.RWMutex
	sessions      map[uuid.UUID]*sessionState
	subscriptions map[string]*subscription
	sequence      int64
}

// NewDispatcher creates an in-memory event bus.
func NewDispatcher() *Dispatcher {
	return &Dispatcher{
		sessions:      map[uuid.UUID]*sessionState{},
		subscriptions: map[string]*subscription{},
	}
}

func (d *Dispatcher) Publish(event Event) QueuedNotification {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.sequence++
	event.Sequence = d.sequence
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now().UTC()
	}

	state := d.sessionStateLocked(event.SessionID)
	refresh := resolveRefresh(state.controls, event)
	notification := QueuedNotification{Event: event, Refresh: refresh}
	state.queue = append(state.queue, notification)
	return notification
}

func (d *Dispatcher) Subscribe(sessionID uuid.UUID, controls []ControlDependency) string {
	d.mu.Lock()
	defer d.mu.Unlock()

	state := d.sessionStateLocked(sessionID)
	state.controls = append([]ControlDependency(nil), controls...)
	subscriptionID := uuid.NewString()
	state.subscriptions[subscriptionID] = struct{}{}
	d.subscriptions[subscriptionID] = &subscription{id: subscriptionID, sessionID: sessionID}
	return subscriptionID
}

func (d *Dispatcher) Unsubscribe(subscriptionID string) {
	d.mu.Lock()
	defer d.mu.Unlock()

	sub, ok := d.subscriptions[subscriptionID]
	if !ok {
		return
	}
	delete(d.subscriptions, subscriptionID)
	if state, ok := d.sessions[sub.sessionID]; ok {
		delete(state.subscriptions, subscriptionID)
	}
}

func (d *Dispatcher) Poll(sessionID uuid.UUID) []QueuedNotification {
	d.mu.Lock()
	defer d.mu.Unlock()

	state := d.sessionStateLocked(sessionID)
	if len(state.queue) == 0 {
		return []QueuedNotification{}
	}
	pending := append([]QueuedNotification(nil), state.queue...)
	state.queue = nil
	return pending
}

func (d *Dispatcher) RegisterDependencies(sessionID uuid.UUID, controls []ControlDependency) {
	d.mu.Lock()
	defer d.mu.Unlock()
	state := d.sessionStateLocked(sessionID)
	state.controls = append([]ControlDependency(nil), controls...)
}

func (d *Dispatcher) Dependencies(sessionID uuid.UUID) []ControlDependency {
	d.mu.RLock()
	defer d.mu.RUnlock()
	state := d.sessions[sessionID]
	if state == nil {
		return nil
	}
	return append([]ControlDependency(nil), state.controls...)
}

func (d *Dispatcher) ClearSession(sessionID uuid.UUID) {
	d.mu.Lock()
	defer d.mu.Unlock()
	delete(d.sessions, sessionID)
	for id, sub := range d.subscriptions {
		if sub.sessionID == sessionID {
			delete(d.subscriptions, id)
		}
	}
}

func (d *Dispatcher) sessionStateLocked(sessionID uuid.UUID) *sessionState {
	state, ok := d.sessions[sessionID]
	if !ok {
		state = &sessionState{subscriptions: map[string]struct{}{}}
		d.sessions[sessionID] = state
	}
	return state
}
