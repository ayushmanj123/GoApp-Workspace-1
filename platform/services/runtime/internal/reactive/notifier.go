package reactive

import (
	"time"

	"github.com/google/uuid"
)

// Notifier publishes well-known runtime events.
type Notifier struct {
	bus EventBus
}

func NewNotifier(bus EventBus) *Notifier {
	return &Notifier{bus: bus}
}

func (n *Notifier) VariableChanged(sessionID, appID uuid.UUID, name string) RefreshResponse {
	return notificationRefresh(n.publish(sessionID, appID, EventVariableChanged, map[string]any{"name": name}))
}

func (n *Notifier) CollectionChanged(sessionID, appID uuid.UUID, name string) RefreshResponse {
	return notificationRefresh(n.publish(sessionID, appID, EventCollectionChanged, map[string]any{"name": name}))
}

func (n *Notifier) ContextChanged(sessionID, appID uuid.UUID, screen string, keys []string) RefreshResponse {
	return notificationRefresh(n.publish(sessionID, appID, EventContextChanged, map[string]any{
		"screen": screen,
		"keys":   keys,
	}))
}

func (n *Notifier) DatasourceChanged(sessionID, appID uuid.UUID, name string) RefreshResponse {
	return notificationRefresh(n.publish(sessionID, appID, EventDatasourceChanged, map[string]any{"name": name}))
}

func (n *Notifier) NavigationRequested(sessionID, appID uuid.UUID, screen string) RefreshResponse {
	return notificationRefresh(n.publish(sessionID, appID, EventNavigationRequested, map[string]any{"screen": screen}))
}

func (n *Notifier) FormulaExecuted(sessionID, appID uuid.UUID, formula string) RefreshResponse {
	return notificationRefresh(n.publish(sessionID, appID, EventFormulaExecuted, map[string]any{"formula": formula}))
}

func (n *Notifier) GallerySelectionChanged(sessionID, appID uuid.UUID, gallery string) RefreshResponse {
	return notificationRefresh(n.publish(sessionID, appID, EventGallerySelectionChanged, map[string]any{"gallery": gallery}))
}

func (n *Notifier) FormChanged(sessionID, appID uuid.UUID, form string) RefreshResponse {
	return notificationRefresh(n.publish(sessionID, appID, EventFormChanged, map[string]any{"form": form}))
}

func (n *Notifier) publish(sessionID, appID uuid.UUID, eventType EventType, payload map[string]any) QueuedNotification {
	if n == nil || n.bus == nil {
		return QueuedNotification{}
	}
	return n.bus.Publish(Event{
		SessionID: sessionID,
		AppID:     appID,
		Type:      eventType,
		Payload:   payload,
		Timestamp: time.Now().UTC(),
	})
}

func notificationRefresh(notification QueuedNotification) RefreshResponse {
	return RefreshResponse{Refresh: notification.Refresh}
}

// Publisher is the interface consumed by the formula engine.
type Publisher interface {
	VariableChanged(sessionID, appID uuid.UUID, name string) RefreshResponse
	CollectionChanged(sessionID, appID uuid.UUID, name string) RefreshResponse
	ContextChanged(sessionID, appID uuid.UUID, screen string, keys []string) RefreshResponse
	DatasourceChanged(sessionID, appID uuid.UUID, name string) RefreshResponse
	NavigationRequested(sessionID, appID uuid.UUID, screen string) RefreshResponse
	FormulaExecuted(sessionID, appID uuid.UUID, formula string) RefreshResponse
	GallerySelectionChanged(sessionID, appID uuid.UUID, gallery string) RefreshResponse
	FormChanged(sessionID, appID uuid.UUID, form string) RefreshResponse
}
