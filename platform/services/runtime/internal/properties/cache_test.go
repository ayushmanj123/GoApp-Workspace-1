package properties

import (
	"testing"

	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/google/uuid"
)

func TestCacheInvalidatesAffectedPropertyOnly(t *testing.T) {
	cache := NewCache()
	sessionID := uuid.New()
	deps := []PropertyDependency{{
		ControlID: "lblStatus",
		Property:  "Text",
		Variables: []string{"varSaved"},
	}, {
		ControlID: "lblStatus",
		Property:  "Visible",
		Variables: []string{"varVisible"},
	}}

	cache.Set(sessionID, "lblStatus", "Text", "yes")
	cache.Set(sessionID, "lblStatus", "Visible", true)

	cache.InvalidateEvent(sessionID, reactive.Event{
		Type: reactive.EventVariableChanged,
		Payload: map[string]any{
			"name": "varSaved",
		},
	}, deps)

	if _, ok := cache.Get(sessionID, "lblStatus", "Text"); ok {
		t.Fatal("Text should be invalidated")
	}
	if value, ok := cache.Get(sessionID, "lblStatus", "Visible"); !ok || value != true {
		t.Fatalf("Visible should remain cached, got %#v ok=%v", value, ok)
	}
}

func TestCacheInvalidatesGalleryDependency(t *testing.T) {
	cache := NewCache()
	sessionID := uuid.New()
	deps := []PropertyDependency{{
		ControlID: "lblCustomer",
		Property:  "Text",
		Galleries: []string{"Gallery1"},
	}}

	cache.Set(sessionID, "lblCustomer", "Text", "Alice")
	cache.InvalidateEvent(sessionID, reactive.Event{
		Type:    reactive.EventGallerySelectionChanged,
		Payload: map[string]any{"gallery": "Gallery1"},
	}, deps)

	if _, ok := cache.Get(sessionID, "lblCustomer", "Text"); ok {
		t.Fatal("gallery-dependent Text should be invalidated")
	}
}

func TestCacheClearSession(t *testing.T) {
	cache := NewCache()
	sessionID := uuid.New()
	cache.Set(sessionID, "lblA", "Text", "value")
	cache.ClearSession(sessionID)
	if _, ok := cache.Get(sessionID, "lblA", "Text"); ok {
		t.Fatal("session cache should be cleared")
	}
}
