package state

import (
	"sync"
	"testing"

	"github.com/google/uuid"
)

func TestVariableCRUD(t *testing.T) {
	store := NewMemoryStore()
	appID := uuid.New()
	sessionID := store.CreateSession(appID)
	manager, err := store.GetManager(appID, sessionID)
	if err != nil {
		t.Fatalf("get manager: %v", err)
	}

	manager.SetVariable("title", "Hello")
	value, ok := manager.GetVariable("title")
	if !ok || value != "Hello" {
		t.Fatalf("unexpected variable value: %#v %v", value, ok)
	}

	if err := manager.UpdateVariable("title", "Updated"); err != nil {
		t.Fatalf("update: %v", err)
	}
	value, _ = manager.GetVariable("title")
	if value != "Updated" {
		t.Fatalf("expected updated value, got %#v", value)
	}

	if err := manager.DeleteVariable("title"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, ok := manager.GetVariable("title"); ok {
		t.Fatal("expected variable to be deleted")
	}
}

func TestCollectionOperations(t *testing.T) {
	store := NewMemoryStore()
	appID := uuid.New()
	sessionID := store.CreateSession(appID)
	manager, err := store.GetManager(appID, sessionID)
	if err != nil {
		t.Fatalf("get manager: %v", err)
	}

	manager.Collect("Customers", map[string]any{"Name": "Alice"})
	manager.Collect("Customers", map[string]any{"Name": "Bob"})
	if manager.CountRows("Customers") != 2 {
		t.Fatalf("expected 2 rows, got %d", manager.CountRows("Customers"))
	}

	first, ok := manager.First("Customers")
	if !ok || first.(map[string]any)["Name"] != "Alice" {
		t.Fatalf("unexpected first row: %#v", first)
	}
	last, ok := manager.Last("Customers")
	if !ok || last.(map[string]any)["Name"] != "Bob" {
		t.Fatalf("unexpected last row: %#v", last)
	}

	manager.ClearCollect("Customers", []any{map[string]any{"Name": "Cara"}})
	if manager.CountRows("Customers") != 1 {
		t.Fatalf("expected one row after clearCollect")
	}

	manager.Clear("Customers")
	if manager.CountRows("Customers") != 0 {
		t.Fatal("expected empty collection after clear")
	}
}

func TestContextIsolation(t *testing.T) {
	store := NewMemoryStore()
	appID := uuid.New()
	sessionID := store.CreateSession(appID)
	manager, err := store.GetManager(appID, sessionID)
	if err != nil {
		t.Fatalf("get manager: %v", err)
	}

	manager.UpdateContext("ScreenA", map[string]any{"mode": "edit"})
	manager.UpdateContext("ScreenB", map[string]any{"mode": "view"})

	modeA, ok := manager.GetContext("ScreenA", "mode")
	if !ok || modeA != "edit" {
		t.Fatalf("unexpected ScreenA context: %#v", modeA)
	}
	modeB, ok := manager.GetContext("ScreenB", "mode")
	if !ok || modeB != "view" {
		t.Fatalf("unexpected ScreenB context: %#v", modeB)
	}
}

func TestSessionIsolation(t *testing.T) {
	store := NewMemoryStore()
	appID := uuid.New()
	sessionOne := store.CreateSession(appID)
	sessionTwo := store.CreateSession(appID)

	managerOne, err := store.GetManager(appID, sessionOne)
	if err != nil {
		t.Fatalf("get manager one: %v", err)
	}
	managerTwo, err := store.GetManager(appID, sessionTwo)
	if err != nil {
		t.Fatalf("get manager two: %v", err)
	}

	managerOne.SetVariable("counter", 1)
	managerTwo.SetVariable("counter", 2)

	valueOne, _ := managerOne.GetVariable("counter")
	valueTwo, _ := managerTwo.GetVariable("counter")
	if valueOne != 1 || valueTwo != 2 {
		t.Fatalf("sessions leaked state: %v %v", valueOne, valueTwo)
	}
}

func TestConcurrentUpdates(t *testing.T) {
	store := NewMemoryStore()
	appID := uuid.New()
	sessionID := store.CreateSession(appID)
	manager, err := store.GetManager(appID, sessionID)
	if err != nil {
		t.Fatalf("get manager: %v", err)
	}

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			manager.Collect("Items", map[string]any{"Index": index})
		}(i)
	}
	wg.Wait()

	if manager.CountRows("Items") != 100 {
		t.Fatalf("expected 100 rows, got %d", manager.CountRows("Items"))
	}
}

func TestSnapshot(t *testing.T) {
	store := NewMemoryStore()
	appID := uuid.New()
	sessionID := store.CreateSession(appID)
	manager, err := store.GetManager(appID, sessionID)
	if err != nil {
		t.Fatalf("get manager: %v", err)
	}

	manager.SetVariable("title", "Snapshot")
	manager.Collect("Customers", map[string]any{"Name": "Alice"})
	manager.UpdateContext("Home", map[string]any{"ready": true})

	snapshot := manager.Snapshot()
	if snapshot.AppID != appID || snapshot.SessionID != sessionID {
		t.Fatal("snapshot missing session identifiers")
	}
	if snapshot.GlobalVariables["title"] != "Snapshot" {
		t.Fatal("snapshot missing global variable")
	}
	if len(snapshot.Collections["Customers"]) != 1 {
		t.Fatal("snapshot missing collection")
	}
	if snapshot.ContextVariables["Home"]["ready"] != true {
		t.Fatal("snapshot missing context variable")
	}

	manager.SetVariable("title", "Changed")
	if snapshot.GlobalVariables["title"] != "Snapshot" {
		t.Fatal("snapshot should be immutable copy")
	}
}

func TestInvalidSession(t *testing.T) {
	store := NewMemoryStore()
	_, err := store.GetManager(uuid.New(), uuid.New())
	if err != ErrSessionNotFound {
		t.Fatalf("expected session not found, got %v", err)
	}
}
