package renderer

import (
	"context"
	"strings"

	runtimemetrics "github.com/goapps-platform/runtime-service/internal/metrics"
	"github.com/goapps-platform/runtime-service/internal/properties"
	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/google/uuid"
)

// SessionAccess resolves runtime sessions for rendering.
type SessionAccess interface {
	properties.SessionAccess
	ScreenName(screenID string) string
}

// Engine renders metadata-driven control trees through the property engine.
type Engine struct {
	properties   *properties.Engine
	cache        *Cache
	dependencies map[uuid.UUID][]properties.PropertyDependency
}

func NewEngine(propertiesEngine *properties.Engine) *Engine {
	return &Engine{
		properties:   propertiesEngine,
		cache:        NewCache(),
		dependencies: map[uuid.UUID][]properties.PropertyDependency{},
	}
}

func (e *Engine) ClearSession(sessionID uuid.UUID) {
	if e == nil {
		return
	}
	e.cache.ClearSession(sessionID)
	delete(e.dependencies, sessionID)
}

func (e *Engine) RegisterDependencies(sessionID uuid.UUID, controls []properties.ControlDefinition) {
	if e == nil {
		return
	}
	deps := make([]properties.PropertyDependency, 0)
	for _, control := range controls {
		deps = append(deps, properties.AnalyzeControlDependencies(control)...)
	}
	e.dependencies[sessionID] = deps
}

func (e *Engine) InvalidateControl(sessionID uuid.UUID, controlID string) {
	if e == nil {
		return
	}
	e.cache.InvalidateControl(sessionID, "", controlID)
}

func (e *Engine) InvalidateEvent(sessionID uuid.UUID, event reactive.Event) {
	if e == nil {
		return
	}
	e.cache.InvalidateEvent(sessionID, event, e.dependencies[sessionID])
}

// RenderScreen returns the full screen render tree, reusing cached controls when valid.
func (e *Engine) RenderScreen(ctx context.Context, session SessionAccess, sessionID uuid.UUID, screenID string) (screen Screen, err error) {
	err = runtimemetrics.TimeRenderer("render_screen", func() error {
		screen, err = e.render(ctx, session, sessionID, screenID, nil)
		return err
	})
	return screen, err
}

// RenderControls incrementally renders only the requested controls on a screen.
func (e *Engine) RenderControls(ctx context.Context, session SessionAccess, sessionID uuid.UUID, screenID string, controlIDs []string) (Screen, error) {
	return e.render(ctx, session, sessionID, screenID, controlIDs)
}

func (e *Engine) render(ctx context.Context, session SessionAccess, sessionID uuid.UUID, screenID string, onlyControls []string) (Screen, error) {
	if e == nil || e.properties == nil {
		return Screen{}, properties.ErrControlNotFound
	}
	screenName := session.ScreenName(screenID)

	if len(onlyControls) > 0 {
		controls := filterControls(session.ControlsOnScreen(screenID), onlyControls)
		rendered := make([]Control, 0, len(controls))
		for _, control := range controls {
			item, err := e.renderControl(ctx, session, sessionID, screenName, control)
			if err != nil {
				return Screen{}, err
			}
			rendered = append(rendered, item)
		}
		return Screen{Screen: screenName, Controls: rendered}, nil
	}

	controls := session.ControlsOnScreen(screenID)
	rendered := make([]Control, 0, len(controls))
	for _, control := range controls {
		if cached, ok := e.cache.Get(sessionID, screenName, control.Name); ok {
			rendered = append(rendered, cached)
			continue
		}
		item, err := e.renderControl(ctx, session, sessionID, screenName, control)
		if err != nil {
			return Screen{}, err
		}
		rendered = append(rendered, item)
	}
	return Screen{Screen: screenName, Controls: rendered}, nil
}

func (e *Engine) renderControl(ctx context.Context, session SessionAccess, sessionID uuid.UUID, screenName string, control properties.ControlDefinition) (Control, error) {
	evaluated, err := e.properties.EvaluateControl(ctx, session, sessionID, control.Name)
	if err != nil {
		return Control{}, err
	}
	item := Control{
		ID:         control.Name,
		Type:       control.ControlType,
		Properties: evaluated.Properties,
	}
	e.cache.Set(sessionID, screenName, item)
	return item, nil
}

func filterControls(controls []properties.ControlDefinition, controlIDs []string) []properties.ControlDefinition {
	if len(controlIDs) == 0 {
		return controls
	}
	filtered := make([]properties.ControlDefinition, 0, len(controlIDs))
	for _, control := range controls {
		if containsControlID(controlIDs, control.Name) || containsControlID(controlIDs, control.ID.String()) {
			filtered = append(filtered, control)
		}
	}
	return filtered
}

func containsControlID(controlIDs []string, controlID string) bool {
	for _, id := range controlIDs {
		if strings.EqualFold(strings.TrimSpace(id), controlID) {
			return true
		}
	}
	return false
}
