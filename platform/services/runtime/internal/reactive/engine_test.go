package reactive

import (
	"sync"
	"testing"

	"github.com/google/uuid"
)

func TestPublishSubscribeAndPoll(t *testing.T) {
	engine := NewEngine()
	sessionID := uuid.New()
	appID := uuid.New()

	engine.RegisterDependencies(sessionID, []ControlDependency{
		{ControlID: "lblTotal", Variables: []string{"total"}},
	})

	subscriptionID := engine.bus.Subscribe(sessionID, []ControlDependency{
		{ControlID: "lblTotal", Variables: []string{"total"}},
	})
	if subscriptionID == "" {
		t.Fatal("expected subscription id")
	}

	notification := engine.Notifier.VariableChanged(sessionID, appID, "total")
	if len(notification.Refresh) != 1 || notification.Refresh[0].ControlID != "lblTotal" {
		t.Fatalf("unexpected refresh: %#v", notification.Refresh)
	}

	polled := engine.Poll(sessionID)
	if len(polled) != 1 {
		t.Fatalf("expected one polled event, got %d", len(polled))
	}
	if polled[0].Event.Type != EventVariableChanged {
		t.Fatalf("unexpected event type: %s", polled[0].Event.Type)
	}

	engine.bus.Unsubscribe(subscriptionID)
}

func TestDependencyLookupAndRefreshCalculation(t *testing.T) {
	controls := []ControlDependency{
		{ControlID: "galleryOrders", Collections: []string{"Orders"}, DataSources: []string{"Orders"}},
		{ControlID: "lblTotal", Variables: []string{"total"}},
		{ControlID: "lblOther", Variables: []string{"other"}},
	}

	refresh := resolveRefresh(controls, Event{
		Type:    EventCollectionChanged,
		Payload: map[string]any{"name": "Orders"},
	})
	if len(refresh) != 1 || refresh[0].ControlID != "galleryOrders" {
		t.Fatalf("unexpected refresh: %#v", refresh)
	}
}

func TestContextDependencyIsolation(t *testing.T) {
	controls := []ControlDependency{
		{ControlID: "screenAControl", Screen: "ScreenA", ContextKeys: []string{"mode"}},
		{ControlID: "screenBControl", Screen: "ScreenB", ContextKeys: []string{"mode"}},
	}

	refresh := resolveRefresh(controls, Event{
		Type:    EventContextChanged,
		Payload: map[string]any{"screen": "ScreenA", "keys": []string{"mode"}},
	})
	if len(refresh) != 1 || refresh[0].ControlID != "screenAControl" {
		t.Fatalf("unexpected refresh: %#v", refresh)
	}
}

func TestConcurrentSubscribers(t *testing.T) {
	engine := NewEngine()
	sessionID := uuid.New()
	appID := uuid.New()
	engine.RegisterDependencies(sessionID, []ControlDependency{
		{ControlID: "lblTotal", Variables: []string{"total"}},
	})

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			engine.bus.Subscribe(sessionID, []ControlDependency{
				{ControlID: "lblTotal", Variables: []string{"total"}},
			})
			engine.Notifier.VariableChanged(sessionID, appID, "total")
		}()
	}
	wg.Wait()

	polled := engine.Poll(sessionID)
	if len(polled) != 20 {
		t.Fatalf("expected 20 events, got %d", len(polled))
	}
}

func TestEventOrdering(t *testing.T) {
	engine := NewEngine()
	sessionID := uuid.New()
	appID := uuid.New()

	engine.Notifier.VariableChanged(sessionID, appID, "a")
	engine.Notifier.CollectionChanged(sessionID, appID, "Customers")
	engine.Notifier.DatasourceChanged(sessionID, appID, "Customers")

	polled := engine.Poll(sessionID)
	if len(polled) != 3 {
		t.Fatalf("expected 3 events, got %d", len(polled))
	}
	if polled[0].Event.Sequence >= polled[1].Event.Sequence || polled[1].Event.Sequence >= polled[2].Event.Sequence {
		t.Fatalf("events out of order: %#v", polled)
	}
}

func TestMergeRefreshDedupesControls(t *testing.T) {
	merged := MergeRefresh(
		RefreshResponse{Refresh: []RefreshInstruction{{ControlID: "lblTotal", Reason: "VariableChanged"}}},
		RefreshResponse{Refresh: []RefreshInstruction{{ControlID: "lblTotal", Reason: "FormulaExecuted"}}},
	)
	if len(merged) != 1 {
		t.Fatalf("expected one merged refresh, got %d", len(merged))
	}
}
