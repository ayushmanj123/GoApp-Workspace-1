package gallery

import (
	"context"
	"testing"

	"github.com/goapps-platform/runtime-service/internal/databinding"
	"github.com/goapps-platform/runtime-service/internal/formula"
	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/goapps-platform/runtime-service/internal/state"
	"github.com/google/uuid"
)

type fakeQuerier struct {
	results       map[string]*databinding.QueryResult
	lastOverrides databinding.QueryOverrides
}

func (f *fakeQuerier) QueryDataSource(ctx context.Context, tenantID, userID, appID uuid.UUID, dataSourceName string, overrides databinding.QueryOverrides) (*databinding.QueryResult, error) {
	_ = ctx
	_ = tenantID
	_ = userID
	_ = appID
	f.lastOverrides = overrides
	if result, ok := f.results[dataSourceName]; ok {
		return result, nil
	}
	return &databinding.QueryResult{Items: []databinding.DataItem{}, Count: 0}, nil
}

func TestLoadEntityDatasource(t *testing.T) {
	store := NewSessionStore()
	querier := &fakeQuerier{results: map[string]*databinding.QueryResult{
		"Customers": {
			Items: []databinding.DataItem{
				{"Name": "Alice", "recordId": "1"},
				{"Name": "Bob", "recordId": "2"},
			},
			Count: 2,
		},
	}}
	svc := NewService(store, querier, nil)
	sessionID := uuid.New()
	control := ControlMetadata{
		Name:        "galleryCustomers",
		ControlType: "gallery",
		Formulas:    []FormulaBinding{{PropertyName: "items", FormulaText: "Customers"}},
		EntityNames: []string{"Customers"},
	}

	state, err := svc.Load(context.Background(), sessionID, uuid.New(), uuid.New(), uuid.New(), control)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(state.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(state.Items))
	}
	if state.Items[0]["Name"] != "Alice" {
		t.Fatalf("unexpected first item: %#v", state.Items[0])
	}
}

func TestLoadEmptyDatasource(t *testing.T) {
	store := NewSessionStore()
	querier := &fakeQuerier{results: map[string]*databinding.QueryResult{
		"Customers": {Items: []databinding.DataItem{}, Count: 0},
	}}
	svc := NewService(store, querier, nil)
	state, err := svc.Load(context.Background(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), ControlMetadata{
		Name:        "galleryCustomers",
		ControlType: "gallery",
		Formulas:    []FormulaBinding{{PropertyName: "items", FormulaText: "Customers"}},
		EntityNames: []string{"Customers"},
	})
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(state.Items) != 0 {
		t.Fatalf("expected empty gallery, got %#v", state.Items)
	}
}

func TestLoadPassesFilterPropertyToQueryOverrides(t *testing.T) {
	store := NewSessionStore()
	querier := &fakeQuerier{results: map[string]*databinding.QueryResult{
		"Customers": {
			Items: []databinding.DataItem{{"Name": "Alice", "Status": "Active"}},
			Count: 1,
		},
	}}
	svc := NewService(store, querier, nil)
	sessionID := uuid.New()
	control := ControlMetadata{
		Name:        "galleryCustomers",
		ControlType: "gallery",
		Formulas:    []FormulaBinding{{PropertyName: "items", FormulaText: "Customers"}},
		Properties:  map[string]interface{}{"filter": "Status='Active'"},
		EntityNames: []string{"Customers"},
	}

	if _, err := svc.Load(context.Background(), sessionID, uuid.New(), uuid.New(), uuid.New(), control); err != nil {
		t.Fatalf("Load: %v", err)
	}
	if querier.lastOverrides.Filter != "Status='Active'" {
		t.Fatalf("expected filter override to be passed through, got %q", querier.lastOverrides.Filter)
	}
}

func TestLoadWithoutFilterPropertyLeavesOverrideEmpty(t *testing.T) {
	store := NewSessionStore()
	querier := &fakeQuerier{results: map[string]*databinding.QueryResult{
		"Customers": {Items: []databinding.DataItem{{"Name": "Alice"}}, Count: 1},
	}}
	svc := NewService(store, querier, nil)
	control := ControlMetadata{
		Name:        "galleryCustomers",
		ControlType: "gallery",
		Formulas:    []FormulaBinding{{PropertyName: "items", FormulaText: "Customers"}},
		EntityNames: []string{"Customers"},
	}

	if _, err := svc.Load(context.Background(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), control); err != nil {
		t.Fatalf("Load: %v", err)
	}
	if querier.lastOverrides.Filter != "" {
		t.Fatalf("expected empty filter override, got %q", querier.lastOverrides.Filter)
	}
}

func TestReloadForSourcePassesFilterPropertyToQueryOverrides(t *testing.T) {
	store := NewSessionStore()
	querier := &fakeQuerier{results: map[string]*databinding.QueryResult{
		"Customers": {Items: []databinding.DataItem{{"Name": "Alice"}}, Count: 1},
	}}
	svc := NewService(store, querier, nil)
	sessionID := uuid.New()
	control := ControlMetadata{
		Name:        "galleryCustomers",
		ControlType: "gallery",
		Formulas:    []FormulaBinding{{PropertyName: "items", FormulaText: "Customers"}},
		Properties:  map[string]interface{}{"filter": "Status='Active'"},
		EntityNames: []string{"Customers"},
	}
	if _, err := svc.Load(context.Background(), sessionID, uuid.New(), uuid.New(), uuid.New(), control); err != nil {
		t.Fatalf("initial load: %v", err)
	}

	querier.lastOverrides = databinding.QueryOverrides{}
	if _, err := svc.ReloadForSource(context.Background(), sessionID, uuid.New(), uuid.New(), uuid.New(), "Customers", []ControlMetadata{control}, nil); err != nil {
		t.Fatalf("ReloadForSource: %v", err)
	}
	if querier.lastOverrides.Filter != "Status='Active'" {
		t.Fatalf("expected filter override on reload, got %q", querier.lastOverrides.Filter)
	}
}

func TestSelectItem(t *testing.T) {
	store := NewSessionStore()
	svc := NewService(store, nil, nil)
	sessionID := uuid.New()
	svc.store.Set(sessionID, "galleryOrders", &State{
		Items: []map[string]interface{}{
			{"Name": "First"},
			{"Name": "Second"},
		},
	})

	selected, err := svc.Select(sessionID, "galleryOrders", 1)
	if err != nil {
		t.Fatalf("Select: %v", err)
	}
	if selected["Name"] != "Second" {
		t.Fatalf("unexpected selection: %#v", selected)
	}
}

func TestReloadForCollectionSource(t *testing.T) {
	store := NewSessionStore()
	svc := NewService(store, nil, nil)
	stateStore := state.NewMemoryStore()
	appID := uuid.New()
	sessionID := stateStore.CreateSession(appID)
	manager, err := stateStore.GetManager(appID, sessionID)
	if err != nil {
		t.Fatalf("GetManager: %v", err)
	}
	manager.ClearCollect("Orders", []any{
		map[string]interface{}{"Name": "A"},
		map[string]interface{}{"Name": "B"},
	})

	control := ControlMetadata{
		Name:        "galleryOrders",
		ControlType: "gallery",
		Formulas:    []FormulaBinding{{PropertyName: "items", FormulaText: "Orders"}},
	}
	if _, err := svc.Load(context.Background(), sessionID, uuid.New(), uuid.New(), appID, control); err != nil {
		t.Fatalf("initial load: %v", err)
	}

	manager.Collect("Orders", map[string]interface{}{"Name": "C"})
	if _, err := svc.ReloadForSource(context.Background(), sessionID, uuid.New(), uuid.New(), appID, "Orders", []ControlMetadata{control}, manager); err != nil {
		t.Fatalf("ReloadForSource: %v", err)
	}
	loaded, err := svc.Get(sessionID, "galleryOrders")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if len(loaded.Items) != 3 {
		t.Fatalf("expected 3 items after collect reload, got %d", len(loaded.Items))
	}
}

func TestCollectionGalleryAppliesFilter(t *testing.T) {
	store := NewSessionStore()
	svc := NewService(store, nil, nil)
	stateStore := state.NewMemoryStore()
	appID := uuid.New()
	sessionID := stateStore.CreateSession(appID)
	manager, err := stateStore.GetManager(appID, sessionID)
	if err != nil {
		t.Fatalf("GetManager: %v", err)
	}
	manager.ClearCollect("Orders", []any{
		map[string]interface{}{"Name": "A", "Status": "Open"},
		map[string]interface{}{"Name": "B", "Status": "Closed"},
		map[string]interface{}{"Name": "C", "Status": "Open"},
	})

	control := ControlMetadata{
		Name:        "galleryOrders",
		ControlType: "gallery",
		Formulas: []FormulaBinding{
			{PropertyName: "items", FormulaText: "Orders"},
			{PropertyName: "filter", FormulaText: "Status='Open'"},
		},
	}
	if _, err := svc.ReloadForSource(context.Background(), sessionID, uuid.New(), uuid.New(), appID, "Orders", []ControlMetadata{control}, manager); err != nil {
		t.Fatalf("ReloadForSource: %v", err)
	}
	loaded, err := svc.Get(sessionID, "galleryOrders")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if len(loaded.Items) != 2 {
		t.Fatalf("expected 2 Open items, got %d %#v", len(loaded.Items), loaded.Items)
	}
	for _, item := range loaded.Items {
		if item["Status"] != "Open" {
			t.Fatalf("unexpected item: %#v", item)
		}
	}
}

func TestClearCollectRefresh(t *testing.T) {
	store := NewSessionStore()
	svc := NewService(store, nil, nil)
	stateStore := state.NewMemoryStore()
	appID := uuid.New()
	sessionID := stateStore.CreateSession(appID)
	manager, err := stateStore.GetManager(appID, sessionID)
	if err != nil {
		t.Fatalf("GetManager: %v", err)
	}
	control := ControlMetadata{
		Name:        "galleryOrders",
		ControlType: "gallery",
		Formulas:    []FormulaBinding{{PropertyName: "items", FormulaText: "Orders"}},
	}
	manager.ClearCollect("Orders", []any{map[string]interface{}{"Name": "Only"}})
	if _, err := svc.Load(context.Background(), sessionID, uuid.New(), uuid.New(), appID, control); err != nil {
		t.Fatalf("initial load: %v", err)
	}
	manager.ClearCollect("Orders", []any{map[string]interface{}{"Name": "Reset"}})
	if _, err := svc.ReloadForSource(context.Background(), sessionID, uuid.New(), uuid.New(), appID, "Orders", []ControlMetadata{control}, manager); err != nil {
		t.Fatalf("ReloadForSource: %v", err)
	}
	loaded, err := svc.Get(sessionID, "galleryOrders")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if len(loaded.Items) != 1 || loaded.Items[0]["Name"] != "Reset" {
		t.Fatalf("expected reset item, got %#v", loaded.Items)
	}
}

func TestPatchRefreshReloadsEntityGallery(t *testing.T) {
	store := NewSessionStore()
	querier := &fakeQuerier{results: map[string]*databinding.QueryResult{
		"Customers": {
			Items: []databinding.DataItem{{"Name": "Alice"}},
			Count: 1,
		},
	}}
	svc := NewService(store, querier, nil)
	sessionID := uuid.New()
	control := ControlMetadata{
		Name:        "galleryCustomers",
		ControlType: "gallery",
		Formulas:    []FormulaBinding{{PropertyName: "items", FormulaText: "Customers"}},
		EntityNames: []string{"Customers"},
	}
	if _, err := svc.Load(context.Background(), sessionID, uuid.New(), uuid.New(), uuid.New(), control); err != nil {
		t.Fatalf("Load: %v", err)
	}

	querier.results["Customers"] = &databinding.QueryResult{
		Items: []databinding.DataItem{{"Name": "Alice"}, {"Name": "Charlie"}},
		Count: 2,
	}
	if _, err := svc.ReloadForSource(context.Background(), sessionID, uuid.New(), uuid.New(), uuid.New(), "Customers", []ControlMetadata{control}, nil); err != nil {
		t.Fatalf("ReloadForSource: %v", err)
	}
	loaded, err := svc.Get(sessionID, "galleryCustomers")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if len(loaded.Items) != 2 {
		t.Fatalf("expected 2 items after patch refresh, got %d", len(loaded.Items))
	}
}

func TestFormulaGallerySelectedAndAllItems(t *testing.T) {
	store := NewSessionStore()
	stateStore := state.NewMemoryStore()
	appID := uuid.New()
	sessionID := stateStore.CreateSession(appID)
	manager, err := stateStore.GetManager(appID, sessionID)
	if err != nil {
		t.Fatalf("GetManager: %v", err)
	}
	store.Set(sessionID, "galleryOrders", &State{
		Items: []map[string]interface{}{
			{"Name": "First"},
			{"Name": "Second"},
		},
		Selected: map[string]interface{}{"Name": "Second"},
	})

	reader := NewReader(store, sessionID)
	evaluator := formula.NewEvaluator()
	rtCtx := &formula.RuntimeFormulaContext{
		State:   manager,
		Gallery: reader,
		Session: formula.SessionContext{SessionID: sessionID, Screen: "Home"},
		Events:  reactive.NewEngine().Notifier,
		App:     formula.AppContext{AppID: appID},
	}

	selected, err := evaluator.Evaluate(rtCtx, "galleryOrders.Selected")
	if err != nil {
		t.Fatalf("Selected: %v", err)
	}
	if selected.(map[string]interface{})["Name"] != "Second" {
		t.Fatalf("unexpected selected: %#v", selected)
	}

	count, err := evaluator.Evaluate(rtCtx, "CountRows(galleryOrders.AllItems)")
	if err != nil {
		t.Fatalf("CountRows: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected count 2, got %#v", count)
	}

	first, err := evaluator.Evaluate(rtCtx, "First(galleryOrders.AllItems)")
	if err != nil {
		t.Fatalf("First: %v", err)
	}
	if first.(map[string]interface{})["Name"] != "First" {
		t.Fatalf("unexpected first: %#v", first)
	}

	last, err := evaluator.Evaluate(rtCtx, "Last(galleryOrders.AllItems)")
	if err != nil {
		t.Fatalf("Last: %v", err)
	}
	if last.(map[string]interface{})["Name"] != "Second" {
		t.Fatalf("unexpected last: %#v", last)
	}
}

func TestGallerySelectionReactiveRefresh(t *testing.T) {
	engine := reactive.NewEngine()
	sessionID := uuid.New()
	appID := uuid.New()
	engine.RegisterDependencies(sessionID, []reactive.ControlDependency{
		{ControlID: "lblSelected", Galleries: []string{"galleryOrders"}},
		{ControlID: "galleryOrders", DataSources: []string{"Orders"}},
	})

	selectionRefresh := engine.Notifier.GallerySelectionChanged(sessionID, appID, "galleryOrders")
	if len(selectionRefresh.Refresh) != 1 || selectionRefresh.Refresh[0].ControlID != "lblSelected" {
		t.Fatalf("expected lblSelected refresh, got %#v", selectionRefresh.Refresh)
	}

	datasourceRefresh := engine.Notifier.DatasourceChanged(sessionID, appID, "Orders")
	foundGallery := false
	for _, item := range datasourceRefresh.Refresh {
		if item.ControlID == "galleryOrders" {
			foundGallery = true
		}
		if item.ControlID == "lblSelected" {
			t.Fatal("datasource refresh should not reload unrelated label")
		}
	}
	if !foundGallery {
		t.Fatalf("expected gallery refresh, got %#v", datasourceRefresh.Refresh)
	}
}
