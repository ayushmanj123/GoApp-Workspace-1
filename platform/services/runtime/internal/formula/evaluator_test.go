package formula

import (
	"context"
	"errors"
	"testing"

	"github.com/goapps-platform/runtime-service/internal/databinding"
	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/goapps-platform/runtime-service/internal/state"
	"github.com/google/uuid"
)

type fakeResolver struct {
	bindings map[string]*databinding.ResolvedBinding
	err      error
}

func (f *fakeResolver) Resolve(_ context.Context, _, _ uuid.UUID, dataSourceName string, _ databinding.QueryOverrides) (*databinding.ResolvedBinding, databinding.QueryInput, error) {
	if f.err != nil {
		return nil, databinding.QueryInput{}, f.err
	}
	binding, ok := f.bindings[dataSourceName]
	if !ok {
		return nil, databinding.QueryInput{}, databinding.ErrDataSourceNotFound
	}
	return binding, databinding.QueryInput{EntityID: binding.EntityID}, nil
}

type fakeDataSource struct {
	queryFn  func() (*databinding.QueryResult, error)
	createFn func() (databinding.DataItem, error)
	updateFn func() (databinding.DataItem, error)
}

func (f *fakeDataSource) Kind() databinding.DataSourceKind { return databinding.DataSourceKindEntity }

func (f *fakeDataSource) Query(_ context.Context, _ databinding.QueryInput) (*databinding.QueryResult, error) {
	if f.queryFn != nil {
		return f.queryFn()
	}
	return &databinding.QueryResult{}, nil
}

func (f *fakeDataSource) Get(context.Context, uuid.UUID, uuid.UUID, databinding.DataSourceKey, uuid.UUID) (*databinding.DataItem, error) {
	return nil, nil
}

func (f *fakeDataSource) Create(context.Context, uuid.UUID, uuid.UUID, databinding.DataSourceKey, map[string]interface{}) (*databinding.DataItem, error) {
	if f.createFn != nil {
		item, err := f.createFn()
		return &item, err
	}
	return &databinding.DataItem{"Name": "Created"}, nil
}

func (f *fakeDataSource) Update(context.Context, uuid.UUID, uuid.UUID, databinding.DataSourceKey, uuid.UUID, map[string]interface{}, int) (*databinding.DataItem, error) {
	if f.updateFn != nil {
		item, err := f.updateFn()
		return &item, err
	}
	return &databinding.DataItem{"Name": "Updated"}, nil
}

func (f *fakeDataSource) Delete(context.Context, uuid.UUID, uuid.UUID, databinding.DataSourceKey, uuid.UUID) error {
	return nil
}

func testRuntimeContext(t *testing.T) *RuntimeFormulaContext {
	t.Helper()
	store := state.NewMemoryStore()
	appID := uuid.New()
	sessionID := store.CreateSession(appID)
	manager, err := store.GetManager(appID, sessionID)
	if err != nil {
		t.Fatalf("manager: %v", err)
	}
	entityID := uuid.New()
	return &RuntimeFormulaContext{
		Ctx:   context.Background(),
		State: manager,
		Resolver: &fakeResolver{bindings: map[string]*databinding.ResolvedBinding{
			"Customers": {EntityID: entityID, Kind: databinding.DataSourceKindEntity},
		}},
		DataSources: databinding.NewDataSourceRegistry(&fakeDataSource{}),
		Navigation:  NoopNavigationService{},
		User: UserContext{
			TenantID: uuid.New(),
			UserID:   uuid.New(),
		},
		App:     AppContext{AppID: appID},
		Session: SessionContext{SessionID: sessionID, Screen: "Home"},
	}
}

func TestSetAndGetVariable(t *testing.T) {
	evaluator := NewEvaluator()
	rtCtx := testRuntimeContext(t)

	result, err := evaluator.Evaluate(rtCtx, `Set(x,123)`)
	if err != nil {
		t.Fatalf("set: %v", err)
	}
	if result != 123 {
		t.Fatalf("expected 123, got %#v", result)
	}
	value, ok := rtCtx.State.GetVariable("x")
	if !ok || value != 123 {
		t.Fatalf("variable not stored: %#v", value)
	}
}

func TestUpdateContext(t *testing.T) {
	evaluator := NewEvaluator()
	rtCtx := testRuntimeContext(t)

	_, err := evaluator.Evaluate(rtCtx, `UpdateContext({ mode: "edit" })`)
	if err != nil {
		t.Fatalf("update context: %v", err)
	}
	value, ok := rtCtx.State.GetContext("Home", "mode")
	if !ok || value != "edit" {
		t.Fatalf("context not stored: %#v", value)
	}
}

func TestCollectAndClearCollect(t *testing.T) {
	evaluator := NewEvaluator()
	rtCtx := testRuntimeContext(t)

	_, err := evaluator.Evaluate(rtCtx, `Collect(Customers, { Name: "Alice" })`)
	if err != nil {
		t.Fatalf("collect: %v", err)
	}
	if rtCtx.State.CountRows("Customers") != 1 {
		t.Fatal("expected one row")
	}

	_, err = evaluator.Evaluate(rtCtx, `ClearCollect(Customers, { Name: "Bob" })`)
	if err != nil {
		t.Fatalf("clearCollect: %v", err)
	}
	if rtCtx.State.CountRows("Customers") != 1 {
		t.Fatal("expected one row after clearCollect")
	}
	last, ok := rtCtx.State.Last("Customers")
	if !ok || last.(map[string]interface{})["Name"] != "Bob" {
		t.Fatalf("unexpected last row: %#v", last)
	}
}

func TestFirstLastCountRows(t *testing.T) {
	evaluator := NewEvaluator()
	rtCtx := testRuntimeContext(t)
	rtCtx.State.ClearCollect("Customers", []any{
		map[string]interface{}{"Name": "Alice"},
		map[string]interface{}{"Name": "Bob"},
	})

	count, err := evaluator.Evaluate(rtCtx, `CountRows(Customers)`)
	if err != nil || count != 2 {
		t.Fatalf("countRows: %#v %v", count, err)
	}

	first, err := evaluator.Evaluate(rtCtx, `First(Customers)`)
	if err != nil {
		t.Fatalf("first: %v", err)
	}
	if first.(map[string]interface{})["Name"] != "Alice" {
		t.Fatalf("unexpected first: %#v", first)
	}

	last, err := evaluator.Evaluate(rtCtx, `Last(Customers)`)
	if err != nil {
		t.Fatalf("last: %v", err)
	}
	if last.(map[string]interface{})["Name"] != "Bob" {
		t.Fatalf("unexpected last: %#v", last)
	}
}

func TestPatchAndDefaults(t *testing.T) {
	evaluator := NewEvaluator()
	rtCtx := testRuntimeContext(t)

	defaults, err := evaluator.Evaluate(rtCtx, `Defaults(Customers)`)
	if err != nil {
		t.Fatalf("defaults: %v", err)
	}
	if defaults == nil {
		t.Fatal("expected defaults record")
	}

	patched, err := evaluator.Evaluate(rtCtx, `Patch(Customers, { Name: "Alice" })`)
	if err != nil {
		t.Fatalf("patch create: %v", err)
	}
	if patched.(databinding.DataItem)["Name"] != "Created" {
		t.Fatalf("unexpected patch result: %#v", patched)
	}
}

type fakeStorageRemoveDataSource struct {
	deletedKey string
}

func (f *fakeStorageRemoveDataSource) Kind() databinding.DataSourceKind {
	return databinding.DataSourceKindStorage
}
func (f *fakeStorageRemoveDataSource) Query(context.Context, databinding.QueryInput) (*databinding.QueryResult, error) {
	return &databinding.QueryResult{}, nil
}
func (f *fakeStorageRemoveDataSource) Get(context.Context, uuid.UUID, uuid.UUID, databinding.DataSourceKey, uuid.UUID) (*databinding.DataItem, error) {
	return nil, nil
}
func (f *fakeStorageRemoveDataSource) Create(context.Context, uuid.UUID, uuid.UUID, databinding.DataSourceKey, map[string]interface{}) (*databinding.DataItem, error) {
	return &databinding.DataItem{"key": "created"}, nil
}
func (f *fakeStorageRemoveDataSource) Update(context.Context, uuid.UUID, uuid.UUID, databinding.DataSourceKey, uuid.UUID, map[string]interface{}, int) (*databinding.DataItem, error) {
	return nil, errors.New("unsupported")
}
func (f *fakeStorageRemoveDataSource) Delete(context.Context, uuid.UUID, uuid.UUID, databinding.DataSourceKey, uuid.UUID) error {
	return nil
}
func (f *fakeStorageRemoveDataSource) DeleteByObjectKey(_ context.Context, _, _ uuid.UUID, _ databinding.DataSourceKey, objectKey string) error {
	f.deletedKey = objectKey
	return nil
}

func TestRemoveStorageObject(t *testing.T) {
	evaluator := NewEvaluator()
	rtCtx := testRuntimeContext(t)
	connectorID := uuid.New()
	storageDS := &fakeStorageRemoveDataSource{}
	rtCtx.Resolver = &fakeResolver{bindings: map[string]*databinding.ResolvedBinding{
		"DocsBucket": {EntityID: connectorID, Kind: databinding.DataSourceKindStorage},
	}}
	rtCtx.DataSources = databinding.NewDataSourceRegistry(nil).SetStorage(storageDS)

	result, err := evaluator.Evaluate(rtCtx, `Remove(DocsBucket, { key: "invoices/a.txt" })`)
	if err != nil {
		t.Fatalf("Remove: %v", err)
	}
	if result != true {
		t.Fatalf("expected true, got %#v", result)
	}
	if storageDS.deletedKey != "invoices/a.txt" {
		t.Fatalf("unexpected deleted key: %q", storageDS.deletedKey)
	}
}

func TestLookUpReturnsFirstMatch(t *testing.T) {
	evaluator := NewEvaluator()
	rtCtx := testRuntimeContext(t)
	entityID := uuid.New()
	rtCtx.Resolver = &fakeResolver{bindings: map[string]*databinding.ResolvedBinding{
		"Customers": {EntityID: entityID, Kind: databinding.DataSourceKindEntity},
	}}
	rtCtx.DataSources = databinding.NewDataSourceRegistry(&fakeDataSource{
		queryFn: func() (*databinding.QueryResult, error) {
			return &databinding.QueryResult{
				Items: []databinding.DataItem{{"Name": "Alice", "Status": "Active"}},
			}, nil
		},
	})

	result, err := evaluator.Evaluate(rtCtx, `LookUp(Customers, Status='Active')`)
	if err != nil {
		t.Fatalf("LookUp: %v", err)
	}
	item, ok := result.(databinding.DataItem)
	if !ok || item["Name"] != "Alice" {
		t.Fatalf("unexpected LookUp result: %#v", result)
	}

	rtCtx.DataSources = databinding.NewDataSourceRegistry(&fakeDataSource{
		queryFn: func() (*databinding.QueryResult, error) {
			return &databinding.QueryResult{Items: nil}, nil
		},
	})
	blank, err := evaluator.Evaluate(rtCtx, `LookUp(Customers, Status='Missing')`)
	if err != nil {
		t.Fatalf("LookUp blank: %v", err)
	}
	if blank != nil {
		t.Fatalf("expected blank, got %#v", blank)
	}
}

func TestFilterReturnsMatchingRows(t *testing.T) {
	evaluator := NewEvaluator()
	rtCtx := testRuntimeContext(t)
	entityID := uuid.New()
	rtCtx.Resolver = &fakeResolver{bindings: map[string]*databinding.ResolvedBinding{
		"Customers": {EntityID: entityID, Kind: databinding.DataSourceKindEntity},
	}}
	rtCtx.DataSources = databinding.NewDataSourceRegistry(&fakeDataSource{
		queryFn: func() (*databinding.QueryResult, error) {
			return &databinding.QueryResult{
				Items: []databinding.DataItem{
					{"Name": "Alice", "Status": "Active"},
					{"Name": "Bob", "Status": "Active"},
				},
			}, nil
		},
	})

	result, err := evaluator.Evaluate(rtCtx, `Filter(Customers, Status='Active')`)
	if err != nil {
		t.Fatalf("Filter: %v", err)
	}
	rows, ok := result.([]any)
	if !ok || len(rows) != 2 {
		t.Fatalf("expected 2 rows, got %#v", result)
	}

	rtCtx.DataSources = databinding.NewDataSourceRegistry(&fakeDataSource{
		queryFn: func() (*databinding.QueryResult, error) {
			return &databinding.QueryResult{Items: nil}, nil
		},
	})
	empty, err := evaluator.Evaluate(rtCtx, `Filter(Customers, Status='Missing')`)
	if err != nil {
		t.Fatalf("Filter empty: %v", err)
	}
	emptyRows, ok := empty.([]any)
	if !ok || len(emptyRows) != 0 {
		t.Fatalf("expected empty table, got %#v", empty)
	}
}

func TestEntityTableReference(t *testing.T) {
	evaluator := NewEvaluator()
	rtCtx := testRuntimeContext(t)
	rtCtx.Resolver = &fakeResolver{bindings: map[string]*databinding.ResolvedBinding{
		"Customers": {EntityID: uuid.New(), Kind: databinding.DataSourceKindEntity},
	}}
	rtCtx.DataSources = databinding.NewDataSourceRegistry(&fakeDataSource{
		queryFn: func() (*databinding.QueryResult, error) {
			return &databinding.QueryResult{
				Items: []databinding.DataItem{{"Name": "Alice"}, {"Name": "Bob"}},
			}, nil
		},
	})

	value, err := evaluator.Evaluate(rtCtx, "Customers")
	if err != nil {
		t.Fatalf("entity table: %v", err)
	}
	items, ok := value.([]any)
	if !ok || len(items) != 2 {
		t.Fatalf("expected 2 rows, got %#v", value)
	}
	count, err := evaluator.Evaluate(rtCtx, "CountRows(Customers)")
	if err != nil {
		t.Fatalf("CountRows: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected CountRows=2, got %#v", count)
	}
}

func TestInvalidDataSource(t *testing.T) {
	evaluator := NewEvaluator()
	rtCtx := testRuntimeContext(t)
	rtCtx.Resolver = &fakeResolver{bindings: map[string]*databinding.ResolvedBinding{}}

	_, err := evaluator.Evaluate(rtCtx, `Defaults(Missing)`)
	var formulaErr *FormulaError
	if !asFormulaError(err, &formulaErr) || formulaErr.Code != "DATASOURCE_NOT_FOUND" {
		t.Fatalf("expected datasource not found, got %v", err)
	}
}

func TestContextIsolationBetweenScreens(t *testing.T) {
	store := state.NewMemoryStore()
	appID := uuid.New()
	sessionID := store.CreateSession(appID)
	manager, _ := store.GetManager(appID, sessionID)

	screenA := &RuntimeFormulaContext{
		Ctx: context.Background(), State: manager, Session: SessionContext{Screen: "ScreenA"},
	}
	screenB := &RuntimeFormulaContext{
		Ctx: context.Background(), State: manager, Session: SessionContext{Screen: "ScreenB"},
	}
	evaluator := NewEvaluator()

	_, err := evaluator.Evaluate(screenA, `UpdateContext({ mode: "edit" })`)
	if err != nil {
		t.Fatalf("screenA: %v", err)
	}
	_, err = evaluator.Evaluate(screenB, `UpdateContext({ mode: "view" })`)
	if err != nil {
		t.Fatalf("screenB: %v", err)
	}

	modeA, _ := manager.GetContext("ScreenA", "mode")
	modeB, _ := manager.GetContext("ScreenB", "mode")
	if modeA != "edit" || modeB != "view" {
		t.Fatalf("context leaked: %v %v", modeA, modeB)
	}
}

func TestRuntimeContextInjection(t *testing.T) {
	store := state.NewMemoryStore()
	appID := uuid.New()
	sessionID := store.CreateSession(appID)
	manager, _ := store.GetManager(appID, sessionID)

	custom := &RuntimeFormulaContext{
		Ctx:   context.Background(),
		State: manager,
		App:   AppContext{AppID: appID},
		Session: SessionContext{SessionID: sessionID},
	}
	custom.State.SetVariable("injected", true)

	evaluator := NewEvaluator()
	result, err := evaluator.Evaluate(custom, `Set(copy, injected)`)
	if err != nil {
		t.Fatalf("evaluate: %v", err)
	}
	if result != true {
		t.Fatalf("expected injected variable value, got %#v", result)
	}
}

func TestRuntimeFormulaError(t *testing.T) {
	evaluator := NewEvaluator()
	rtCtx := testRuntimeContext(t)
	_, err := evaluator.Evaluate(rtCtx, `NotAFunction()`)
	var formulaErr *FormulaError
	if !asFormulaError(err, &formulaErr) {
		t.Fatalf("expected formula error, got %v", err)
	}
}

func asFormulaError(err error, target **FormulaError) bool {
	formulaErr, ok := err.(*FormulaError)
	if !ok {
		return false
	}
	*target = formulaErr
	return true
}

func TestIfFormula(t *testing.T) {
	evaluator := NewEvaluator()
	rtCtx := testRuntimeContext(t)
	rtCtx.State.SetVariable("show", true)

	trueResult, err := evaluator.Evaluate(rtCtx, `If(show, "Edit", "Disabled")`)
	if err != nil || trueResult != "Edit" {
		t.Fatalf("If true branch: %#v %v", trueResult, err)
	}

	rtCtx.State.SetVariable("show", false)
	falseResult, err := evaluator.Evaluate(rtCtx, `If(show, "Edit", "Disabled")`)
	if err != nil || falseResult != "Disabled" {
		t.Fatalf("If false branch: %#v %v", falseResult, err)
	}
}

func TestIfFormulaEnumBranches(t *testing.T) {
	evaluator := NewEvaluator()
	rtCtx := testRuntimeContext(t)
	rtCtx.State.SetVariable("valid", true)

	result, err := evaluator.Evaluate(rtCtx, `If(valid, Edit, Disabled)`)
	if err != nil || result != "Edit" {
		t.Fatalf("enum branch: %#v %v", result, err)
	}
}

// TestNavigateWithoutNavigationServiceIsNotImplemented documents the
// standalone-endpoint stub: when no session/reactive-aware navigation is
// available, Navigate() reports NAVIGATION_NOT_IMPLEMENTED rather than
// silently succeeding (Phase 7.15).
func TestNavigateWithoutNavigationServiceIsNotImplemented(t *testing.T) {
	evaluator := NewEvaluator()
	rtCtx := testRuntimeContext(t)
	rtCtx.Navigation = NoopNavigationService{}

	_, err := evaluator.Evaluate(rtCtx, `Navigate(Details)`)
	var formulaErr *FormulaError
	if !asFormulaError(err, &formulaErr) || formulaErr.Code != "NAVIGATION_NOT_IMPLEMENTED" {
		t.Fatalf("expected NAVIGATION_NOT_IMPLEMENTED, got %v", err)
	}
}

// TestNavigateWithReactiveNavigationServiceSucceeds mirrors the
// runtime.Service.Evaluate wiring for POST /api/runtime/formula/evaluate:
// once a reactive engine is present, Navigate() must not stub out with
// NAVIGATION_NOT_IMPLEMENTED (Phase 7.15).
func TestNavigateWithReactiveNavigationServiceSucceeds(t *testing.T) {
	evaluator := NewEvaluator()
	rtCtx := testRuntimeContext(t)
	engine := reactive.NewEngine()
	nav := &reactive.NavigationService{
		Publisher: engine.Notifier,
		SessionID: rtCtx.Session.SessionID,
		AppID:     rtCtx.App.AppID,
	}
	nav.OnNavigate = rtCtx.RecordRefresh
	rtCtx.Navigation = nav

	_, err := evaluator.Evaluate(rtCtx, `Navigate(Details)`)
	if err != nil {
		t.Fatalf("expected Navigate to succeed once a reactive navigation service is wired, got %v", err)
	}
}

func TestUserFormula(t *testing.T) {
	evaluator := NewEvaluator()
	rtCtx := testRuntimeContext(t)
	rtCtx.User.Email = "john.doe@example.com"

	fullName, err := evaluator.Evaluate(rtCtx, `User().FullName`)
	if err != nil || fullName == nil {
		t.Fatalf("User().FullName: %#v %v", fullName, err)
	}
	if fullName == "" {
		t.Fatal("expected non-empty full name")
	}

	email, err := evaluator.Evaluate(rtCtx, `User.Email`)
	if err != nil || email != "john.doe@example.com" {
		t.Fatalf("User.Email: %#v %v", email, err)
	}
}
