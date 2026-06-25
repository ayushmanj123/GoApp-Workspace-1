package integration

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/goapps-platform/runtime-service/internal/databinding"
	"github.com/goapps-platform/runtime-service/internal/form"
	"github.com/goapps-platform/runtime-service/internal/gallery"
	"github.com/goapps-platform/runtime-service/internal/kernel"
	"github.com/goapps-platform/runtime-service/internal/properties"
	"github.com/goapps-platform/runtime-service/internal/records"
	"github.com/goapps-platform/runtime-service/internal/renderer"
	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/goapps-platform/runtime-service/internal/state"
	"github.com/google/uuid"
)

const (
	customerAppID        = "00000000-0000-4000-8000-000000000010"
	customerEntityID     = "00000000-0000-4000-8000-000000000013"
	customerListScreen   = "CustomerList"
	customerEditScreen   = "CustomerEdit"
	customerGalleryName  = "galleryCustomers"
	customerFormName     = "formCustomer"
)

type customerMetadataRepo struct {
	appID    uuid.UUID
	entityID uuid.UUID
}

func (r *customerMetadataRepo) key(name string) string {
	return r.appID.String() + ":" + name
}

func (r *customerMetadataRepo) ResolveEntity(_ context.Context, tenantID, appID uuid.UUID, dataSourceName string) (*databinding.ResolvedBinding, error) {
	if appID != r.appID || dataSourceName != "Customer" {
		return nil, databinding.ErrDataSourceNotFound
	}
	return &databinding.ResolvedBinding{
		EntityID: r.entityID,
		Kind:     databinding.DataSourceKindEntity,
		Name:     "Customer",
		Metadata: databinding.ControlBindingMetadata{DataSource: "Customer"},
	}, nil
}

func (r *customerMetadataRepo) LoadBindingMetadata(_ context.Context, tenantID, appID uuid.UUID, dataSourceName string) (*databinding.ControlBindingMetadata, error) {
	if appID != r.appID || dataSourceName != "Customer" {
		return nil, databinding.ErrDataSourceNotFound
	}
	return &databinding.ControlBindingMetadata{DataSource: "Customer"}, nil
}

type customerHarness struct {
	kernel   *kernel.RuntimeKernel
	registry *kernel.Registry
	tenantID uuid.UUID
	userID   uuid.UUID
	appID    uuid.UUID
	entityID uuid.UUID
	recordSvc *records.Service
	recordRepo *fakeRecordRepo
}

func newCustomerHarness(t *testing.T) *customerHarness {
	t.Helper()
	tenantID := uuid.MustParse("00000000-0000-4000-8000-000000000001")
	userID := uuid.MustParse("00000000-0000-4000-8000-000000000002")
	appID := uuid.MustParse(customerAppID)
	entityID := uuid.MustParse(customerEntityID)

	schema := &records.EntitySchema{
		EntityID: entityID,
		TenantID: tenantID,
		Name:     "Customer",
		Fields: []records.FieldSchema{
			{Name: "Name", FieldType: "text", IsRequired: true},
			{Name: "Email", FieldType: "text", IsRequired: true},
			{Name: "Phone", FieldType: "text", IsRequired: false},
			{Name: "Status", FieldType: "text", IsRequired: true},
		},
	}
	recordRepo := newFakeRecordRepo()
	schemaRepo := &fakeSchemaRepo{schemas: map[uuid.UUID]*records.EntitySchema{entityID: schema}}
	recordSvc := records.NewService(recordRepo, schemaRepo)

	metadataRepo := &customerMetadataRepo{appID: appID, entityID: entityID}
	resolver := databinding.NewResolver(metadataRepo)
	entityDS := databinding.NewEntityDataSource(recordSvc)
	sources := databinding.NewDataSourceRegistry(entityDS)
	bindingSvc := databinding.NewService(resolver, sources)

	stateStore := state.NewMemoryStore()
	reactiveEngine := reactive.NewEngine()
	galleryStore := gallery.NewSessionStore()
	gallerySvc := gallery.NewService(galleryStore, bindingSvc, resolver)
	formStore := form.NewSessionStore()
	formSvc := form.NewService(formStore, recordSvc, recordSvc, resolver, sources, galleryStore)

	propertiesEngine := properties.NewEngine(nil, reactiveEngine)
	registry := kernel.NewRegistry(stateStore, reactiveEngine, resolver, sources, bindingSvc, gallerySvc, formSvc, propertiesEngine, renderer.NewEngine(propertiesEngine), &staticPackageLoader{pkg: buildCustomerPackage(appID)})
	runtimeKernel := kernel.NewRuntimeKernel(registry)
	propertiesEngine = properties.NewEngine(kernel.NewFormulaEvaluatorAdapter(runtimeKernel), reactiveEngine)
	rendererEngine := renderer.NewEngine(propertiesEngine)
	registry.Properties = propertiesEngine
	registry.Renderer = rendererEngine

	return &customerHarness{
		kernel:     runtimeKernel,
		registry:   registry,
		tenantID:   tenantID,
		userID:     userID,
		appID:      appID,
		entityID:   entityID,
		recordSvc:  recordSvc,
		recordRepo: recordRepo,
	}
}

func (h *customerHarness) startSession(t *testing.T, screen string) uuid.UUID {
	t.Helper()
	resp, err := h.kernel.StartSession(context.Background(), h.tenantID, h.userID, kernel.StartSessionRequest{
		AppID:  h.appID,
		Screen: screen,
	})
	if err != nil {
		t.Fatalf("StartSession: %v", err)
	}
	return resp.SessionID
}

func (h *customerHarness) seedCustomer(t *testing.T, name, email, status string) *records.EntityRecord {
	t.Helper()
	record, err := h.recordSvc.Create(context.Background(), h.tenantID, h.userID, h.entityID, map[string]interface{}{
		"Name":   name,
		"Email":  email,
		"Phone":  "555-0100",
		"Status": status,
	})
	if err != nil {
		t.Fatalf("Create customer: %v", err)
	}
	return record
}

func (h *customerHarness) reloadCustomerGallery(t *testing.T, sessionID uuid.UUID) {
	t.Helper()
	session, ok := h.kernel.Session(sessionID)
	if !ok {
		t.Fatal("session missing")
	}
	controls := []gallery.ControlMetadata{{
		Name: customerGalleryName, ControlType: "gallery", Screen: customerListScreen,
		Formulas: []gallery.FormulaBinding{{PropertyName: "items", FormulaText: "Customer"}},
		EntityNames: []string{"Customer"},
	}}
	if _, err := h.registry.Gallery.ReloadForSource(context.Background(), sessionID, h.tenantID, h.userID, h.appID, "Customer", controls, session.State); err != nil {
		t.Fatalf("ReloadForSource: %v", err)
	}
}

func TestCustomerCreateUpdateDelete(t *testing.T) {
	h := newCustomerHarness(t)
	sessionID := h.startSession(t, customerListScreen)

	_, err := h.kernel.HandleControlEvent(context.Background(), sessionID, kernel.ControlEventRequest{
		AppID:     h.appID,
		Screen:    customerListScreen,
		ControlID: "btnNew",
		Event:     "OnSelect",
	})
	if err != nil {
		t.Fatalf("btnNew: %v", err)
	}

	formControl, _, _, _, err := h.kernel.FormSessionAdapter().FormControl(sessionID, customerFormName)
	if err != nil {
		t.Fatalf("FormControl: %v", err)
	}
	registry := h.registry
	_, err = registry.Form.SetMode(context.Background(), sessionID, h.tenantID, h.appID, formControl, form.ModeNew)
	if err != nil {
		t.Fatalf("SetMode New: %v", err)
	}
	_, err = registry.Form.Update(context.Background(), sessionID, h.tenantID, h.appID, formControl, map[string]interface{}{
		"Name":   "Alice Example",
		"Email":  "alice@example.com",
		"Phone":  "555-1111",
		"Status": "Active",
	})
	if err != nil {
		t.Fatalf("Update form: %v", err)
	}
	_, _, err = registry.Form.Submit(context.Background(), sessionID, h.tenantID, h.userID, h.appID, formControl)
	if err != nil {
		t.Fatalf("Submit new customer: %v", err)
	}

	rows, _, err := h.recordSvc.List(context.Background(), h.tenantID, h.entityID, records.ListOptions{Limit: 10})
	if err != nil || len(rows) != 1 {
		t.Fatalf("expected one customer, got %d err=%v", len(rows), err)
	}
	if rows[0].Data["Name"] != "Alice Example" {
		t.Fatalf("unexpected created record: %#v", rows[0].Data)
	}

	h.reloadCustomerGallery(t, sessionID)
	_, _, err = h.kernel.SelectGalleryItem(context.Background(), sessionID, customerGalleryName, 0)
	if err != nil {
		t.Fatalf("SelectGalleryItem: %v", err)
	}
	_, err = registry.Form.SetMode(context.Background(), sessionID, h.tenantID, h.appID, formControl, form.ModeEdit)
	if err != nil {
		t.Fatalf("SetMode Edit: %v", err)
	}
	_, err = registry.Form.Update(context.Background(), sessionID, h.tenantID, h.appID, formControl, map[string]interface{}{
		"Name": "Alice Updated",
	})
	if err != nil {
		t.Fatalf("Update edit: %v", err)
	}
	_, _, err = registry.Form.Submit(context.Background(), sessionID, h.tenantID, h.userID, h.appID, formControl)
	if err != nil {
		t.Fatalf("Submit update: %v", err)
	}
	updated, err := h.recordSvc.Get(context.Background(), h.tenantID, h.entityID, rows[0].ID)
	if err != nil || updated.Data["Name"] != "Alice Updated" {
		t.Fatalf("update failed: %#v %v", updated, err)
	}

	if err := h.recordSvc.Delete(context.Background(), h.tenantID, h.userID, h.entityID, rows[0].ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	remaining, _, err := h.recordSvc.List(context.Background(), h.tenantID, h.entityID, records.ListOptions{Limit: 10})
	if err != nil || len(remaining) != 0 {
		t.Fatalf("expected no customers after delete, got %d", len(remaining))
	}
}

func TestCustomerValidationErrors(t *testing.T) {
	h := newCustomerHarness(t)
	sessionID := h.startSession(t, customerEditScreen)
	formControl, _, _, _, err := h.kernel.FormSessionAdapter().FormControl(sessionID, customerFormName)
	if err != nil {
		t.Fatalf("FormControl: %v", err)
	}
	registry := h.registry
	_, err = registry.Form.SetMode(context.Background(), sessionID, h.tenantID, h.appID, formControl, form.ModeNew)
	if err != nil {
		t.Fatalf("SetMode: %v", err)
	}
	_, err = registry.Form.Update(context.Background(), sessionID, h.tenantID, h.appID, formControl, map[string]interface{}{
		"Name": "Only Name",
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	state, err := registry.Form.Get(sessionID, customerFormName)
	if err != nil {
		t.Fatalf("Get form: %v", err)
	}
	if len(state.ValidationErrors) == 0 {
		t.Fatal("expected validation errors for missing required fields")
	}
}

func TestGallerySelectionUpdatesForm(t *testing.T) {
	h := newCustomerHarness(t)
	record := h.seedCustomer(t, "Bob Jones", "bob@example.com", "Active")
	sessionID := h.startSession(t, customerListScreen)

	_, _, err := h.kernel.SelectGalleryItem(context.Background(), sessionID, customerGalleryName, 0)
	if err != nil {
		t.Fatalf("SelectGalleryItem: %v", err)
	}
	formControl, _, _, _, err := h.kernel.FormSessionAdapter().FormControl(sessionID, customerFormName)
	if err != nil {
		t.Fatalf("FormControl: %v", err)
	}
	_, err = h.registry.Form.Load(context.Background(), sessionID, h.tenantID, h.userID, h.appID, formControl)
	if err != nil {
		t.Fatalf("Load form: %v", err)
	}
	state, err := h.registry.Form.Get(sessionID, customerFormName)
	if err != nil {
		t.Fatalf("Get form: %v", err)
	}
	if state.CurrentRecord["Name"] != record.Data["Name"] {
		t.Fatalf("gallery selection did not sync form item: %#v", state.CurrentRecord)
	}
}

func TestNavigationPreservesSessionState(t *testing.T) {
	h := newCustomerHarness(t)
	h.seedCustomer(t, "Carol Lane", "carol@example.com", "Active")
	sessionID := h.startSession(t, customerListScreen)

	_, err := h.kernel.HandleControlEvent(context.Background(), sessionID, kernel.ControlEventRequest{
		AppID:     h.appID,
		Screen:    customerListScreen,
		ControlID: "btnEdit",
		Event:     "OnSelect",
	})
	if err != nil {
		t.Fatalf("btnEdit: %v", err)
	}
	session, ok := h.kernel.Session(sessionID)
	if !ok || session.CurrentScreen != customerEditScreen {
		t.Fatalf("expected CustomerEdit screen, got %#v", session)
	}
	if value, ok := session.State.GetVariable("varUserName"); !ok || value == nil {
		t.Fatal("session variable from OnStart should persist across navigation")
	}

	_, err = h.kernel.HandleControlEvent(context.Background(), sessionID, kernel.ControlEventRequest{
		AppID:     h.appID,
		Screen:    customerEditScreen,
		ControlID: "btnBack",
		Event:     "OnSelect",
	})
	if err != nil {
		t.Fatalf("btnBack: %v", err)
	}
	session, ok = h.kernel.Session(sessionID)
	if !ok || session.CurrentScreen != customerListScreen {
		t.Fatalf("Back() should return to CustomerList, got %#v", session)
	}
}

func TestRendererReturnsMetadataDrivenControls(t *testing.T) {
	h := newCustomerHarness(t)
	h.seedCustomer(t, "Dana Smith", "dana@example.com", "Active")
	sessionID := h.startSession(t, customerListScreen)

	_, access, err := h.kernel.RenderSessionAdapter().RenderSession(sessionID)
	if err != nil {
		t.Fatalf("RenderSession: %v", err)
	}
	screen, err := h.registry.Renderer.RenderScreen(context.Background(), access, sessionID, customerListScreen)
	if err != nil {
		t.Fatalf("RenderScreen: %v", err)
	}
	if screen.Screen != customerListScreen {
		t.Fatalf("screen name: %s", screen.Screen)
	}
	if len(screen.Controls) == 0 {
		t.Fatal("expected rendered controls")
	}
	foundGallery := false
	for _, control := range screen.Controls {
		if control.ID == customerGalleryName {
			foundGallery = true
			if control.Type != "gallery" {
				t.Fatalf("unexpected gallery type: %s", control.Type)
			}
			assertLayoutProperties(t, control.Properties, 24, 120, 520, 280)
		}
	}
	if !foundGallery {
		t.Fatalf("gallery control missing from render payload: %#v", screen.Controls)
	}
}

func TestGalleryRefreshAfterSubmit(t *testing.T) {
	h := newCustomerHarness(t)
	sessionID := h.startSession(t, customerListScreen)
	registry := h.registry

	_, err := h.kernel.HandleControlEvent(context.Background(), sessionID, kernel.ControlEventRequest{
		AppID: h.appID, Screen: customerListScreen, ControlID: "btnNew", Event: "OnSelect",
	})
	if err != nil {
		t.Fatalf("btnNew: %v", err)
	}
	formControl, _, _, _, _ := h.kernel.FormSessionAdapter().FormControl(sessionID, customerFormName)
	_, _ = registry.Form.SetMode(context.Background(), sessionID, h.tenantID, h.appID, formControl, form.ModeNew)
	_, _ = registry.Form.Update(context.Background(), sessionID, h.tenantID, h.appID, formControl, map[string]interface{}{
		"Name": "Eve Refresh", "Email": "eve@example.com", "Status": "Active",
	})
	_, dataSource, err := registry.Form.Submit(context.Background(), sessionID, h.tenantID, h.userID, h.appID, formControl)
	if err != nil {
		t.Fatalf("Submit: %v", err)
	}
	if dataSource != "Customer" {
		t.Fatalf("expected Customer datasource refresh, got %s", dataSource)
	}
	h.reloadCustomerGallery(t, sessionID)

	galleryState, err := registry.Gallery.Get(sessionID, customerGalleryName)
	if err != nil {
		t.Fatalf("Get gallery: %v", err)
	}
	if len(galleryState.Items) != 1 {
		t.Fatalf("expected refreshed gallery with 1 item, got %d", len(galleryState.Items))
	}
}

func TestFormResetRestoresValues(t *testing.T) {
	h := newCustomerHarness(t)
	h.seedCustomer(t, "Frank Reset", "frank@example.com", "Active")
	sessionID := h.startSession(t, customerListScreen)
	registry := h.registry

	_, _, _ = h.kernel.SelectGalleryItem(context.Background(), sessionID, customerGalleryName, 0)
	formControl, _, _, _, _ := h.kernel.FormSessionAdapter().FormControl(sessionID, customerFormName)
	_, _ = registry.Form.SetMode(context.Background(), sessionID, h.tenantID, h.appID, formControl, form.ModeEdit)
	_, _ = registry.Form.Update(context.Background(), sessionID, h.tenantID, h.appID, formControl, map[string]interface{}{"Name": "Changed"})
	_, _ = registry.Form.Reset(context.Background(), sessionID, h.tenantID, h.appID, formControl)
	state, err := registry.Form.Get(sessionID, customerFormName)
	if err != nil {
		t.Fatalf("Get form: %v", err)
	}
	if state.CurrentRecord["Name"] != "Frank Reset" {
		t.Fatalf("reset did not restore original value: %#v", state.CurrentRecord)
	}
}

func TestSessionRestorePreservesVariables(t *testing.T) {
	h := newCustomerHarness(t)
	sessionID := h.startSession(t, customerListScreen)
	session, ok := h.kernel.Session(sessionID)
	if !ok {
		t.Fatal("session missing")
	}
	value, ok := session.State.GetVariable("varUserName")
	if !ok || value == nil {
		t.Fatal("expected varUserName from app OnStart")
	}
	session.Touch()
	h.kernel.Session(sessionID)
	restored, ok := h.kernel.Session(sessionID)
	if !ok {
		t.Fatal("session should remain available")
	}
	restoredValue, ok := restored.State.GetVariable("varUserName")
	if !ok || restoredValue != value {
		t.Fatalf("session restore lost variables: %#v", restoredValue)
	}
}

func assertLayoutProperties(
	t *testing.T,
	properties map[string]interface{},
	x, y, width, height int,
) {
	t.Helper()
	if intNumber(properties["X"]) != x {
		t.Fatalf("X: got %v want %d", properties["X"], x)
	}
	if intNumber(properties["Y"]) != y {
		t.Fatalf("Y: got %v want %d", properties["Y"], y)
	}
	if intNumber(properties["Width"]) != width {
		t.Fatalf("Width: got %v want %d", properties["Width"], width)
	}
	if intNumber(properties["Height"]) != height {
		t.Fatalf("Height: got %v want %d", properties["Height"], height)
	}
	if properties["Visible"] != true {
		t.Fatalf("Visible: got %#v", properties["Visible"])
	}
}

func intNumber(value interface{}) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	default:
		return -1
	}
}

type staticPackageLoader struct {
	pkg *kernel.Package
}

func (l *staticPackageLoader) Load(_ context.Context, _, _ uuid.UUID, _ string) (*kernel.Package, error) {
	return l.pkg, nil
}

type fakeSchemaRepo struct {
	schemas map[uuid.UUID]*records.EntitySchema
}

func (f *fakeSchemaRepo) GetEntitySchema(_ context.Context, tenantID, entityID uuid.UUID) (*records.EntitySchema, error) {
	schema, ok := f.schemas[entityID]
	if !ok || schema.TenantID != tenantID {
		return nil, records.ErrEntityNotFound
	}
	return schema, nil
}

type fakeRecordRepo struct {
	mu      sync.Mutex
	records map[uuid.UUID]records.EntityRecord
}

func newFakeRecordRepo() *fakeRecordRepo {
	return &fakeRecordRepo{records: map[uuid.UUID]records.EntityRecord{}}
}

func (f *fakeRecordRepo) Create(_ context.Context, record *records.EntityRecord) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	copy := *record
	f.records[record.ID] = copy
	return nil
}

func (f *fakeRecordRepo) GetByID(_ context.Context, tenantID, entityID, recordID uuid.UUID) (*records.EntityRecord, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	record, ok := f.records[recordID]
	if !ok || record.TenantID != tenantID || record.EntityID != entityID || record.DeletedOn != nil {
		return nil, records.ErrNotFound
	}
	copy := record
	return &copy, nil
}

func (f *fakeRecordRepo) List(_ context.Context, tenantID, entityID uuid.UUID, opts records.ListOptions) ([]records.EntityRecord, int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	items := make([]records.EntityRecord, 0)
	for _, record := range f.records {
		if record.TenantID == tenantID && record.EntityID == entityID && record.DeletedOn == nil {
			items = append(items, record)
		}
	}
	return items, int64(len(items)), nil
}

func (f *fakeRecordRepo) Update(_ context.Context, record *records.EntityRecord, expectedVersion int) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	existing, ok := f.records[record.ID]
	if !ok || existing.DeletedOn != nil {
		return records.ErrNotFound
	}
	if existing.Version != expectedVersion {
		return records.ErrVersionConflict
	}
	record.Version = existing.Version + 1
	record.ModifiedOn = time.Now().UTC()
	f.records[record.ID] = *record
	return nil
}

func (f *fakeRecordRepo) SoftDelete(_ context.Context, tenantID, entityID, recordID, userID uuid.UUID) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	record, ok := f.records[recordID]
	if !ok || record.TenantID != tenantID || record.EntityID != entityID || record.DeletedOn != nil {
		return records.ErrNotFound
	}
	now := time.Now().UTC()
	record.DeletedOn = &now
	record.DeletedBy = &userID
	f.records[recordID] = record
	return nil
}

func buildCustomerPackage(appID uuid.UUID) *kernel.Package {
	listID := uuid.MustParse("00000000-0000-4000-8000-000000000011")
	editID := uuid.MustParse("00000000-0000-4000-8000-000000000012")
	onStart := `Set(varUserName, User().FullName)`
	controls := map[string]kernel.RuntimeControl{
		"gallerycustomers": {
			ID: uuid.MustParse("00000000-0000-4000-8000-000000000015"), Name: customerGalleryName, ControlType: "gallery", Screen: customerListScreen, ScreenID: listID,
			X: 24, Y: 120, Width: 520, Height: 280,
			Formulas: []kernel.RuntimeFormula{{PropertyName: "items", FormulaText: "Customer", FormulaType: "property"}},
		},
		"btnnew": {
			ID: uuid.MustParse("00000000-0000-4000-8000-000000000017"), Name: "btnNew", ControlType: "button", Screen: customerListScreen, ScreenID: listID,
			Formulas: []kernel.RuntimeFormula{{PropertyName: "onSelect", FormulaText: `NewForm(formCustomer); Navigate(CustomerEdit)`, FormulaType: "behavior"}},
		},
		"btnedit": {
			ID: uuid.MustParse("00000000-0000-4000-8000-000000000018"), Name: "btnEdit", ControlType: "button", Screen: customerListScreen, ScreenID: listID,
			Formulas: []kernel.RuntimeFormula{{PropertyName: "onSelect", FormulaText: `EditForm(formCustomer); Navigate(CustomerEdit)`, FormulaType: "behavior"}},
		},
		"btnback": {
			ID: uuid.MustParse("00000000-0000-4000-8000-00000000001f"), Name: "btnBack", ControlType: "button", Screen: customerEditScreen, ScreenID: editID,
			Formulas: []kernel.RuntimeFormula{{PropertyName: "onSelect", FormulaText: `Back()`, FormulaType: "behavior"}},
		},
		"formcustomer": {
			ID: uuid.MustParse("00000000-0000-4000-8000-00000000001b"), Name: customerFormName, ControlType: "form", Screen: customerEditScreen, ScreenID: editID,
			Properties: map[string]interface{}{"dataSource": "Customer", "mode": map[string]interface{}{"value": "View"}},
			Formulas: []kernel.RuntimeFormula{
				{PropertyName: "item", FormulaText: "galleryCustomers.Selected", FormulaType: "property"},
				{PropertyName: "default", FormulaText: "Defaults(Customer)", FormulaType: "property"},
			},
		},
	}
	return &kernel.Package{
		AppID:    appID,
		OnStart:  &onStart,
		Entities: []string{"Customer"},
		Screens: []kernel.RuntimeScreen{
			{ID: listID, Name: customerListScreen},
			{ID: editID, Name: customerEditScreen},
		},
		ScreensByName: map[string]kernel.RuntimeScreen{
			"customerlist": {ID: listID, Name: customerListScreen},
			"customeredit": {ID: editID, Name: customerEditScreen},
		},
		Controls: controls,
	}
}
