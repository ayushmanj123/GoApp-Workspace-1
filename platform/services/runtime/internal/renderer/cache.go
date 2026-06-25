package renderer

import (
	"strings"
	"sync"

	"github.com/goapps-platform/runtime-service/internal/properties"
	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/google/uuid"
)

type screenCache struct {
	controls map[string]Control
}

// Cache stores rendered control trees per session and screen.
type Cache struct {
	mu       sync.RWMutex
	sessions map[uuid.UUID]map[string]*screenCache
}

func NewCache() *Cache {
	return &Cache{sessions: map[uuid.UUID]map[string]*screenCache{}}
}

func (c *Cache) Get(sessionID uuid.UUID, screenKey, controlID string) (Control, bool) {
	if c == nil {
		return Control{}, false
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	screen := c.sessions[sessionID]
	if screen == nil {
		return Control{}, false
	}
	cache := screen[normalizeScreenKey(screenKey)]
	if cache == nil {
		return Control{}, false
	}
	control, ok := cache.controls[strings.ToLower(controlID)]
	return control, ok
}

func (c *Cache) Set(sessionID uuid.UUID, screenKey string, control Control) {
	if c == nil || control.ID == "" {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	screen := c.screenLocked(sessionID)
	cache := screen[normalizeScreenKey(screenKey)]
	if cache == nil {
		cache = &screenCache{controls: map[string]Control{}}
		screen[normalizeScreenKey(screenKey)] = cache
	}
	cache.controls[strings.ToLower(control.ID)] = control
}

func (c *Cache) ClearSession(sessionID uuid.UUID) {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.sessions, sessionID)
}

func (c *Cache) InvalidateControl(sessionID uuid.UUID, screenKey, controlID string) {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	screen := c.sessions[sessionID]
	if screen == nil {
		return
	}
	if screenKey == "" {
		for _, cache := range screen {
			delete(cache.controls, strings.ToLower(controlID))
		}
		return
	}
	cache := screen[normalizeScreenKey(screenKey)]
	if cache == nil {
		return
	}
	delete(cache.controls, strings.ToLower(controlID))
}

func (c *Cache) InvalidateEvent(sessionID uuid.UUID, event reactive.Event, dependencies []properties.PropertyDependency) {
	if c == nil || len(dependencies) == 0 {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	screen := c.sessions[sessionID]
	if screen == nil {
		return
	}
	for _, dep := range dependencies {
		if !dependsOnEvent(dep, event) {
			continue
		}
		screenKey := normalizeScreenKey(dep.Screen)
		cache := screen[screenKey]
		if cache == nil {
			continue
		}
		delete(cache.controls, strings.ToLower(dep.ControlID))
	}
}

func (c *Cache) screenLocked(sessionID uuid.UUID) map[string]*screenCache {
	screen, ok := c.sessions[sessionID]
	if !ok {
		screen = map[string]*screenCache{}
		c.sessions[sessionID] = screen
	}
	return screen
}

func normalizeScreenKey(screen string) string {
	return strings.ToLower(strings.TrimSpace(screen))
}

func dependsOnEvent(dep properties.PropertyDependency, event reactive.Event) bool {
	control := reactive.ControlDependency{
		ControlID:   dep.ControlID,
		Screen:      dep.Screen,
		Variables:   dep.Variables,
		Collections: dep.Collections,
		DataSources: dep.DataSources,
		ContextKeys: dep.ContextKeys,
		Galleries:   dep.Galleries,
		Forms:       dep.Forms,
	}
	return controlDependsOnEvent(control, event)
}

func controlDependsOnEvent(control reactive.ControlDependency, event reactive.Event) bool {
	switch event.Type {
	case reactive.EventVariableChanged:
		return containsString(control.Variables, payloadString(event.Payload, "name"))
	case reactive.EventCollectionChanged:
		return containsString(control.Collections, payloadString(event.Payload, "name"))
	case reactive.EventDatasourceChanged:
		return containsString(control.DataSources, payloadString(event.Payload, "name"))
	case reactive.EventGallerySelectionChanged:
		return containsString(control.Galleries, payloadString(event.Payload, "gallery"))
	case reactive.EventFormChanged:
		return containsString(control.Forms, payloadString(event.Payload, "form"))
	case reactive.EventContextChanged:
		screen := payloadString(event.Payload, "screen")
		if control.Screen != "" && screen != "" && !strings.EqualFold(control.Screen, screen) {
			return false
		}
		keys := payloadStringSlice(event.Payload, "keys")
		if len(keys) == 0 {
			return len(control.ContextKeys) > 0
		}
		for _, key := range keys {
			if containsString(control.ContextKeys, key) {
				return true
			}
		}
		return false
	default:
		return false
	}
}

func payloadString(payload map[string]any, key string) string {
	if payload == nil {
		return ""
	}
	value, ok := payload[key]
	if !ok {
		return ""
	}
	text, ok := value.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(text)
}

func payloadStringSlice(payload map[string]any, key string) []string {
	if payload == nil {
		return nil
	}
	value, ok := payload[key]
	if !ok {
		return nil
	}
	switch typed := value.(type) {
	case []string:
		return typed
	case []any:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			if text, ok := item.(string); ok {
				out = append(out, text)
			}
		}
		return out
	default:
		return nil
	}
}

func containsString(values []string, target string) bool {
	target = strings.TrimSpace(target)
	if target == "" {
		return false
	}
	for _, value := range values {
		if strings.EqualFold(strings.TrimSpace(value), target) {
			return true
		}
	}
	return false
}
