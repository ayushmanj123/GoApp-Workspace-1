package kernel

import (
	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/google/uuid"
)

// propertyPublisher wraps the reactive notifier and invalidates the property cache on each event.
type propertyPublisher struct {
	inner  *reactive.Notifier
	kernel *RuntimeKernel
}

func (k *RuntimeKernel) propertyPublisher() reactive.Publisher {
	if k == nil || k.registry == nil || k.registry.Reactive == nil {
		return nil
	}
	if k.registry.Properties == nil {
		return k.registry.Reactive.Notifier
	}
	return &propertyPublisher{
		inner:  k.registry.Reactive.Notifier,
		kernel: k,
	}
}

func (p *propertyPublisher) VariableChanged(sessionID, appID uuid.UUID, name string) reactive.RefreshResponse {
	resp := p.inner.VariableChanged(sessionID, appID, name)
	p.invalidate(sessionID, appID, reactive.EventVariableChanged, map[string]any{"name": name})
	return resp
}

func (p *propertyPublisher) CollectionChanged(sessionID, appID uuid.UUID, name string) reactive.RefreshResponse {
	resp := p.inner.CollectionChanged(sessionID, appID, name)
	p.invalidate(sessionID, appID, reactive.EventCollectionChanged, map[string]any{"name": name})
	return resp
}

func (p *propertyPublisher) ContextChanged(sessionID, appID uuid.UUID, screen string, keys []string) reactive.RefreshResponse {
	resp := p.inner.ContextChanged(sessionID, appID, screen, keys)
	p.invalidate(sessionID, appID, reactive.EventContextChanged, map[string]any{"screen": screen, "keys": keys})
	return resp
}

func (p *propertyPublisher) DatasourceChanged(sessionID, appID uuid.UUID, name string) reactive.RefreshResponse {
	resp := p.inner.DatasourceChanged(sessionID, appID, name)
	p.invalidate(sessionID, appID, reactive.EventDatasourceChanged, map[string]any{"name": name})
	return resp
}

func (p *propertyPublisher) NavigationRequested(sessionID, appID uuid.UUID, screen string) reactive.RefreshResponse {
	resp := p.inner.NavigationRequested(sessionID, appID, screen)
	p.invalidate(sessionID, appID, reactive.EventNavigationRequested, map[string]any{"screen": screen})
	return resp
}

func (p *propertyPublisher) FormulaExecuted(sessionID, appID uuid.UUID, formula string) reactive.RefreshResponse {
	resp := p.inner.FormulaExecuted(sessionID, appID, formula)
	p.invalidate(sessionID, appID, reactive.EventFormulaExecuted, map[string]any{"formula": formula})
	return resp
}

func (p *propertyPublisher) GallerySelectionChanged(sessionID, appID uuid.UUID, gallery string) reactive.RefreshResponse {
	resp := p.inner.GallerySelectionChanged(sessionID, appID, gallery)
	p.invalidate(sessionID, appID, reactive.EventGallerySelectionChanged, map[string]any{"gallery": gallery})
	return resp
}

func (p *propertyPublisher) FormChanged(sessionID, appID uuid.UUID, form string) reactive.RefreshResponse {
	resp := p.inner.FormChanged(sessionID, appID, form)
	p.invalidate(sessionID, appID, reactive.EventFormChanged, map[string]any{"form": form})
	return resp
}

func (p *propertyPublisher) invalidate(sessionID, appID uuid.UUID, eventType reactive.EventType, payload map[string]any) {
	if p == nil || p.kernel == nil {
		return
	}
	p.kernel.invalidatePropertyEvent(sessionID, reactive.Event{
		Type:      eventType,
		SessionID: sessionID,
		AppID:     appID,
		Payload:   payload,
	})
}
