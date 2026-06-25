package properties

import (
	"strings"
	"sync"

	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/google/uuid"
)

type cacheKey struct {
	controlID string
	property  string
}

type sessionCache struct {
	values map[cacheKey]interface{}
}

// Cache stores per-session evaluated property values.
type Cache struct {
	mu       sync.RWMutex
	sessions map[uuid.UUID]*sessionCache
}

func NewCache() *Cache {
	return &Cache{sessions: map[uuid.UUID]*sessionCache{}}
}

func (c *Cache) Get(sessionID uuid.UUID, controlID, property string) (interface{}, bool) {
	if c == nil {
		return nil, false
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	cache := c.sessions[sessionID]
	if cache == nil {
		return nil, false
	}
	value, ok := cache.values[cacheKey{controlID: strings.ToLower(controlID), property: normalizePropertyName(property)}]
	return value, ok
}

func (c *Cache) Set(sessionID uuid.UUID, controlID, property string, value interface{}) {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	cache := c.sessionCacheLocked(sessionID)
	cache.values[cacheKey{controlID: strings.ToLower(controlID), property: normalizePropertyName(property)}] = value
}

func (c *Cache) ClearSession(sessionID uuid.UUID) {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.sessions, sessionID)
}

func (c *Cache) InvalidateEvent(sessionID uuid.UUID, event reactive.Event, dependencies []PropertyDependency) {
	if c == nil || len(dependencies) == 0 {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	cache := c.sessions[sessionID]
	if cache == nil {
		return
	}
	for _, dep := range dependencies {
		if !dependsOnEvent(dep, event) {
			continue
		}
		delete(cache.values, cacheKey{controlID: strings.ToLower(dep.ControlID), property: normalizePropertyName(dep.Property)})
	}
}

func (c *Cache) InvalidateControl(sessionID uuid.UUID, controlID string) {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	cache := c.sessions[sessionID]
	if cache == nil {
		return
	}
	prefix := strings.ToLower(controlID)
	for key := range cache.values {
		if key.controlID == prefix {
			delete(cache.values, key)
		}
	}
}

func (c *Cache) sessionCacheLocked(sessionID uuid.UUID) *sessionCache {
	cache, ok := c.sessions[sessionID]
	if !ok {
		cache = &sessionCache{values: map[cacheKey]interface{}{}}
		c.sessions[sessionID] = cache
	}
	return cache
}

func dependsOnEvent(dep PropertyDependency, event reactive.Event) bool {
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
		name := payloadString(event.Payload, "name")
		return containsString(control.Variables, name)
	case reactive.EventCollectionChanged:
		name := payloadString(event.Payload, "name")
		return containsString(control.Collections, name)
	case reactive.EventDatasourceChanged:
		name := payloadString(event.Payload, "name")
		return containsString(control.DataSources, name)
	case reactive.EventGallerySelectionChanged:
		name := payloadString(event.Payload, "gallery")
		return containsString(control.Galleries, name)
	case reactive.EventFormChanged:
		name := payloadString(event.Payload, "form")
		return containsString(control.Forms, name)
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

func containsString(values []string, target string) bool {
	target = strings.TrimSpace(target)
	for _, value := range values {
		if strings.EqualFold(value, target) {
			return true
		}
	}
	return false
}
