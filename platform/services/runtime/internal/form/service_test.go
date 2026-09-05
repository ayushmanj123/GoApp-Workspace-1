package form

import (
	"context"
	"errors"
	"testing"

	"github.com/goapps-platform/runtime-service/internal/databinding"
	"github.com/goapps-platform/runtime-service/internal/gallery"
	"github.com/goapps-platform/runtime-service/internal/records"
	"github.com/google/uuid"
)

type fakeRecordService struct {
	schema *records.EntitySchema
	create func(data map[string]interface{}) (*records.EntityRecord, error)
	update func(recordID uuid.UUID, patch map[string]interface{}, version int) (*records.EntityRecord, error)
}

func (f *fakeRecordService) Create(ctx context.Context, tenantID, userID, entityID uuid.UUID, data map[string]interface{}) (*records.EntityRecord, error) {
	_ = ctx
	_ = tenantID
	_ = userID
	_ = entityID
	if f.create != nil {
		return f.create(data)
	}
	return &records.EntityRecord{
		ID:       uuid.New(),
		EntityID: entityID,
		Data:     data,
		Version:  1,
	}, nil
}

func (f *fakeRecordService) Update(ctx context.Context, tenantID, userID, entityID, recordID uuid.UUID, patch map[string]interface{}, expectedVersion int) (*records.EntityRecord, error) {
	_ = ctx
	_ = tenantID
	_ = userID
	_ = entityID
	if f.update != nil {
		return f.update(recordID, patch, expectedVersion)
	}
	data := map[string]interface{}{"Name": "Updated"}
	for key, value := range patch {
		data[key] = value
	}
	return &records.EntityRecord{
		ID:       recordID,
		EntityID: entityID,
		Data:     data,
		Version:  expectedVersion + 1,
	}, nil
}

func (f *fakeRecordService) GetEntitySchema(ctx context.Context, tenantID, entityID uuid.UUID) (*records.EntitySchema, error) {
	_ = ctx
	_ = tenantID
	_ = entityID
	if f.schema != nil {
		return f.schema, nil
	}
	return &records.EntitySchema{
		EntityID: entityID,
		Fields: []records.FieldSchema{
			{Name: "Name", FieldType: "text", IsRequired: true},
		},
	}, nil
}

func testFormControl() ControlMetadata {
	return ControlMetadata{
		Name:        "Form1",
		ControlType: "form",
		Formulas:    []FormulaBinding{{PropertyName: "item", FormulaText: "Gallery1.Selected"}},
		Properties: map[string]interface{}{
			"dataSource": "Customers",
			"mode":       map[string]interface{}{"value": "View"},
		},
		EntityNames: []string{"Customers"},
	}
}

func TestViewModeLoadsGallerySelection(t *testing.T) {
	store := NewSessionStore()
	galleryStore := gallery.NewSessionStore()
	sessionID := uuid.New()
	entityID := uuid.New()
	galleryStore.Set(sessionID, "Gallery1", &gallery.State{
		Selected: map[string]interface{}{
			"recordId": uuid.New().String(),
			"entityId": entityID.String(),
			"version":  1,
			"Name":     "Alice",
		},
	})
	svc := NewService(store, &fakeRecordService{}, &fakeRecordService{}, nil, nil, galleryStore)
	state, err := svc.Load(context.Background(), sessionID, uuid.New(), uuid.New(), uuid.New(), testFormControl())
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if state.Mode != ModeView {
		t.Fatalf("expected View mode, got %s", state.Mode)
	}
	if state.CurrentRecord["Name"] != "Alice" {
		t.Fatalf("expected Alice, got %#v", state.CurrentRecord)
	}
}

func TestEditModeAndDirtyTracking(t *testing.T) {
	store := NewSessionStore()
	galleryStore := gallery.NewSessionStore()
	sessionID := uuid.New()
	galleryStore.Set(sessionID, "Gallery1", &gallery.State{
		Selected: map[string]interface{}{"Name": "Alice", "recordId": uuid.New().String(), "entityId": uuid.New().String(), "version": 1},
	})
	svc := NewService(store, &fakeRecordService{}, &fakeRecordService{}, nil, nil, galleryStore)
	control := testFormControl()
	if _, err := svc.SetMode(context.Background(), sessionID, uuid.New(), uuid.New(), control, ModeEdit); err != nil {
		t.Fatalf("SetMode: %v", err)
	}
	state, err := svc.Update(context.Background(), sessionID, uuid.New(), uuid.New(), control, map[string]interface{}{"Name": "Bob"})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if state.CurrentRecord["Name"] != "Bob" {
		t.Fatalf("expected Bob, got %#v", state.CurrentRecord)
	}
	if len(state.DirtyFields) != 1 {
		t.Fatalf("expected dirty field, got %#v", state.DirtyFields)
	}
	reader := NewReader(store, sessionID)
	unsaved, ok := reader.ResolveReference("Form1.Unsaved")
	if !ok || unsaved != true {
		t.Fatalf("expected unsaved=true, got %#v ok=%v", unsaved, ok)
	}
}

func TestNewModeSubmitCreatesRecord(t *testing.T) {
	store := NewSessionStore()
	entityID := uuid.New()
	created := false
	recordsSvc := &fakeRecordService{
		schema: &records.EntitySchema{
			EntityID: entityID,
			Fields:   []records.FieldSchema{{Name: "Name", FieldType: "text", IsRequired: true}},
		},
		create: func(data map[string]interface{}) (*records.EntityRecord, error) {
			created = true
			return &records.EntityRecord{
				ID:       uuid.New(),
				EntityID: entityID,
				Data:     data,
				Version:  1,
			}, nil
		},
	}
	svc := NewService(store, recordsSvc, recordsSvc, nil, nil, gallery.NewSessionStore())
	sessionID := uuid.New()
	control := testFormControl()
	if _, err := svc.SetMode(context.Background(), sessionID, uuid.New(), uuid.New(), control, ModeNew); err != nil {
		t.Fatalf("SetMode: %v", err)
	}
	if _, err := svc.Update(context.Background(), sessionID, uuid.New(), uuid.New(), control, map[string]interface{}{"Name": "Jane"}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	current, err := svc.Get(sessionID, control.Name)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	current.EntityID = entityID
	current.DataSource = "Customers"
	store.Set(sessionID, control.Name, current)
	state, _, err := svc.Submit(context.Background(), sessionID, uuid.New(), uuid.New(), uuid.New(), control)
	if err != nil {
		t.Fatalf("Submit: %v", err)
	}
	if !created {
		t.Fatal("expected create to be called")
	}
	if state.Mode != ModeView {
		t.Fatalf("expected View after submit, got %s", state.Mode)
	}
}

func TestSubmitExistingUpdatesRecord(t *testing.T) {
	store := NewSessionStore()
	entityID := uuid.New()
	recordID := uuid.New()
	updated := false
	recordsSvc := &fakeRecordService{
		update: func(id uuid.UUID, patch map[string]interface{}, version int) (*records.EntityRecord, error) {
			updated = true
			return &records.EntityRecord{ID: id, EntityID: entityID, Data: patch, Version: version + 1}, nil
		},
	}
	svc := NewService(store, recordsSvc, recordsSvc, nil, nil, gallery.NewSessionStore())
	sessionID := uuid.New()
	control := testFormControl()
	store.Set(sessionID, control.Name, &State{
		Mode: ModeEdit,
		CurrentRecord: map[string]interface{}{
			"recordId": recordID.String(),
			"entityId": entityID.String(),
			"version":  1,
			"Name":     "Alice",
		},
		DirtyFields: map[string]interface{}{"Name": "Alice Updated"},
		EntityID:    entityID,
		DataSource:  "Customers",
	})
	if _, err := svc.Update(context.Background(), sessionID, uuid.New(), uuid.New(), control, map[string]interface{}{"Name": "Alice Updated"}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	_, _, err := svc.Submit(context.Background(), sessionID, uuid.New(), uuid.New(), uuid.New(), control)
	if err != nil {
		t.Fatalf("Submit: %v", err)
	}
	if !updated {
		t.Fatal("expected update to be called")
	}
}

func TestResetRestoresOriginal(t *testing.T) {
	store := NewSessionStore()
	sessionID := uuid.New()
	control := testFormControl()
	store.Set(sessionID, control.Name, &State{
		Mode:             ModeEdit,
		CurrentRecord:    map[string]interface{}{"Name": "Changed"},
		OriginalRecord:   map[string]interface{}{"Name": "Original"},
		DirtyFields:      map[string]interface{}{"Name": "Changed"},
		ValidationErrors: nil,
	})
	state, err := svcReset(store, sessionID, control)
	if err != nil {
		t.Fatalf("Reset: %v", err)
	}
	if state.CurrentRecord["Name"] != "Original" {
		t.Fatalf("expected original restored, got %#v", state.CurrentRecord)
	}
	if len(state.DirtyFields) != 0 {
		t.Fatalf("expected dirty cleared, got %#v", state.DirtyFields)
	}
}

func svcReset(store *SessionStore, sessionID uuid.UUID, control ControlMetadata) (*State, error) {
	svc := NewService(store, &fakeRecordService{}, &fakeRecordService{}, nil, nil, gallery.NewSessionStore())
	return svc.Reset(context.Background(), sessionID, uuid.New(), uuid.New(), control)
}

func TestValidationFailure(t *testing.T) {
	store := NewSessionStore()
	entityID := uuid.New()
	recordsSvc := &fakeRecordService{
		schema: &records.EntitySchema{
			EntityID: entityID,
			Fields:   []records.FieldSchema{{Name: "Name", FieldType: "text", IsRequired: true}},
		},
	}
	svc := NewService(store, recordsSvc, recordsSvc, nil, nil, gallery.NewSessionStore())
	sessionID := uuid.New()
	control := testFormControl()
	store.Set(sessionID, control.Name, &State{
		Mode:          ModeNew,
		CurrentRecord: map[string]interface{}{},
		EntityID:      entityID,
		DataSource:    "Customers",
	})
	_, _, err := svc.Submit(context.Background(), sessionID, uuid.New(), uuid.New(), uuid.New(), control)
	if !errors.Is(err, ErrValidationFailed) {
		t.Fatalf("expected validation failure, got %v", err)
	}
}

func TestGallerySelectionSync(t *testing.T) {
	store := NewSessionStore()
	galleryStore := gallery.NewSessionStore()
	sessionID := uuid.New()
	svc := NewService(store, &fakeRecordService{}, &fakeRecordService{}, nil, nil, galleryStore)
	control := testFormControl()
	galleryStore.Set(sessionID, "Gallery1", &gallery.State{
		Selected: map[string]interface{}{"Name": "First"},
	})
	updated := svc.SyncGallerySelection(sessionID, "Gallery1", []ControlMetadata{control})
	if len(updated) != 1 {
		t.Fatalf("expected one updated form, got %#v", updated)
	}
	state, err := svc.Get(sessionID, control.Name)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if state.CurrentRecord["Name"] != "First" {
		t.Fatalf("expected synced record, got %#v", state.CurrentRecord)
	}
}

func TestFormulaModeAndValid(t *testing.T) {
	store := NewSessionStore()
	sessionID := uuid.New()
	store.Set(sessionID, "Form1", &State{
		Mode:             ModeEdit,
		DirtyFields:      map[string]interface{}{"Name": "x"},
		ValidationErrors: nil,
	})
	reader := NewReader(store, sessionID)
	mode, ok := reader.ResolveReference("Form1.Mode")
	if !ok || mode != "Edit" {
		t.Fatalf("expected Edit mode, got %#v ok=%v", mode, ok)
	}
	valid, ok := reader.ResolveReference("Form1.Valid")
	if !ok || valid != true {
		t.Fatalf("expected valid=true, got %#v ok=%v", valid, ok)
	}
}

type fakeSQLFormDataSource struct {
	created bool
	updated bool
}

func (f *fakeSQLFormDataSource) Kind() databinding.DataSourceKind { return databinding.DataSourceKindSql }
func (f *fakeSQLFormDataSource) Query(context.Context, databinding.QueryInput) (*databinding.QueryResult, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeSQLFormDataSource) Get(context.Context, uuid.UUID, uuid.UUID, databinding.DataSourceKey, uuid.UUID) (*databinding.DataItem, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeSQLFormDataSource) Create(_ context.Context, _, _ uuid.UUID, _ databinding.DataSourceKey, data map[string]interface{}) (*databinding.DataItem, error) {
	f.created = true
	item := databinding.DataItem{"id": uuid.New().String(), "name": data["name"]}
	return &item, nil
}
func (f *fakeSQLFormDataSource) Update(_ context.Context, _, _ uuid.UUID, _ databinding.DataSourceKey, recordID uuid.UUID, data map[string]interface{}, _ int) (*databinding.DataItem, error) {
	f.updated = true
	item := databinding.DataItem{"id": recordID.String(), "name": data["name"]}
	return &item, nil
}
func (f *fakeSQLFormDataSource) Delete(context.Context, uuid.UUID, uuid.UUID, databinding.DataSourceKey, uuid.UUID) error {
	return errors.New("not implemented")
}

func TestSubmitSQLUsesDataSource(t *testing.T) {
	store := NewSessionStore()
	sqlDS := &fakeSQLFormDataSource{}
	registry := databinding.NewDataSourceRegistry(nil).SetSql(sqlDS)
	svc := NewService(store, &fakeRecordService{}, &fakeRecordService{}, nil, registry, gallery.NewSessionStore())
	sessionID := uuid.New()
	connectorID := uuid.New()
	control := testFormControl()

	store.Set(sessionID, control.Name, &State{
		Mode:           ModeNew,
		CurrentRecord:  map[string]interface{}{"name": "Ada"},
		DirtyFields:    map[string]interface{}{"name": "Ada"},
		EntityID:       connectorID,
		DataSource:     "OrdersDb",
		DataSourceKind: string(databinding.DataSourceKindSql),
	})
	state, source, err := svc.Submit(context.Background(), sessionID, uuid.New(), uuid.New(), uuid.New(), control)
	if err != nil {
		t.Fatalf("Submit new: %v", err)
	}
	if !sqlDS.created {
		t.Fatal("expected SQL Create")
	}
	if source != "OrdersDb" || state.Mode != ModeView {
		t.Fatalf("unexpected submit result source=%s mode=%s", source, state.Mode)
	}

	recordID := uuid.New()
	store.Set(sessionID, control.Name, &State{
		Mode: ModeEdit,
		CurrentRecord: map[string]interface{}{
			"id":   recordID.String(),
			"name": "Ada",
		},
		DirtyFields:    map[string]interface{}{"name": "Grace"},
		EntityID:       connectorID,
		DataSource:     "OrdersDb",
		DataSourceKind: string(databinding.DataSourceKindSql),
	})
	if _, err := svc.Update(context.Background(), sessionID, uuid.New(), uuid.New(), control, map[string]interface{}{"name": "Grace"}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	_, _, err = svc.Submit(context.Background(), sessionID, uuid.New(), uuid.New(), uuid.New(), control)
	if err != nil {
		t.Fatalf("Submit edit: %v", err)
	}
	if !sqlDS.updated {
		t.Fatal("expected SQL Update")
	}
}

type fakeStorageFormDataSource struct {
	created bool
	last    map[string]interface{}
}

func (f *fakeStorageFormDataSource) Kind() databinding.DataSourceKind {
	return databinding.DataSourceKindStorage
}
func (f *fakeStorageFormDataSource) Query(context.Context, databinding.QueryInput) (*databinding.QueryResult, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeStorageFormDataSource) Get(context.Context, uuid.UUID, uuid.UUID, databinding.DataSourceKey, uuid.UUID) (*databinding.DataItem, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeStorageFormDataSource) Create(_ context.Context, _, _ uuid.UUID, _ databinding.DataSourceKey, data map[string]interface{}) (*databinding.DataItem, error) {
	f.created = true
	f.last = data
	item := databinding.DataItem{"id": "invoices/a.txt", "key": "invoices/a.txt", "size": 5}
	return &item, nil
}
func (f *fakeStorageFormDataSource) Update(context.Context, uuid.UUID, uuid.UUID, databinding.DataSourceKey, uuid.UUID, map[string]interface{}, int) (*databinding.DataItem, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeStorageFormDataSource) Delete(context.Context, uuid.UUID, uuid.UUID, databinding.DataSourceKey, uuid.UUID) error {
	return errors.New("not implemented")
}

func TestSubmitStorageUsesDataSource(t *testing.T) {
	store := NewSessionStore()
	storageDS := &fakeStorageFormDataSource{}
	registry := databinding.NewDataSourceRegistry(nil).SetStorage(storageDS)
	svc := NewService(store, &fakeRecordService{}, &fakeRecordService{}, nil, registry, gallery.NewSessionStore())
	sessionID := uuid.New()
	connectorID := uuid.New()
	control := testFormControl()

	store.Set(sessionID, control.Name, &State{
		Mode: ModeNew,
		CurrentRecord: map[string]interface{}{
			"key":     "a.txt",
			"content": "hello",
		},
		DirtyFields: map[string]interface{}{
			"key":     "a.txt",
			"content": "hello",
		},
		EntityID:       connectorID,
		DataSource:     "DocsBucket",
		DataSourceKind: string(databinding.DataSourceKindStorage),
	})
	state, source, err := svc.Submit(context.Background(), sessionID, uuid.New(), uuid.New(), uuid.New(), control)
	if err != nil {
		t.Fatalf("Submit new: %v", err)
	}
	if !storageDS.created {
		t.Fatal("expected storage Create")
	}
	if source != "DocsBucket" || state.Mode != ModeView {
		t.Fatalf("unexpected submit result source=%s mode=%s", source, state.Mode)
	}

	store.Set(sessionID, control.Name, &State{
		Mode:           ModeEdit,
		CurrentRecord:  map[string]interface{}{"key": "a.txt"},
		DirtyFields:    map[string]interface{}{"content": "x"},
		EntityID:       connectorID,
		DataSource:     "DocsBucket",
		DataSourceKind: string(databinding.DataSourceKindStorage),
	})
	_, _, err = svc.Submit(context.Background(), sessionID, uuid.New(), uuid.New(), uuid.New(), control)
	if !errors.Is(err, ErrStorageEditMode) {
		t.Fatalf("expected ErrStorageEditMode, got %v", err)
	}
}

type fakeRESTFormDataSource struct {
	created bool
	updated bool
}

func (f *fakeRESTFormDataSource) Kind() databinding.DataSourceKind {
	return databinding.DataSourceKindRest
}
func (f *fakeRESTFormDataSource) Query(context.Context, databinding.QueryInput) (*databinding.QueryResult, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeRESTFormDataSource) Get(context.Context, uuid.UUID, uuid.UUID, databinding.DataSourceKey, uuid.UUID) (*databinding.DataItem, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeRESTFormDataSource) Create(_ context.Context, _, _ uuid.UUID, _ databinding.DataSourceKey, data map[string]interface{}) (*databinding.DataItem, error) {
	f.created = true
	item := databinding.DataItem{"id": uuid.New().String(), "name": data["name"]}
	return &item, nil
}
func (f *fakeRESTFormDataSource) Update(_ context.Context, _, _ uuid.UUID, _ databinding.DataSourceKey, recordID uuid.UUID, data map[string]interface{}, _ int) (*databinding.DataItem, error) {
	f.updated = true
	item := databinding.DataItem{"id": recordID.String(), "name": data["name"]}
	return &item, nil
}
func (f *fakeRESTFormDataSource) Delete(context.Context, uuid.UUID, uuid.UUID, databinding.DataSourceKey, uuid.UUID) error {
	return errors.New("not implemented")
}

func TestSubmitRESTUsesDataSource(t *testing.T) {
	store := NewSessionStore()
	restDS := &fakeRESTFormDataSource{}
	registry := databinding.NewDataSourceRegistry(nil).SetRest(restDS)
	svc := NewService(store, &fakeRecordService{}, &fakeRecordService{}, nil, registry, gallery.NewSessionStore())
	sessionID := uuid.New()
	connectorID := uuid.New()
	control := testFormControl()

	store.Set(sessionID, control.Name, &State{
		Mode:           ModeNew,
		CurrentRecord:  map[string]interface{}{"name": "Ada"},
		DirtyFields:    map[string]interface{}{"name": "Ada"},
		EntityID:       connectorID,
		DataSource:     "WeatherApi",
		DataSourceKind: string(databinding.DataSourceKindRest),
	})
	state, source, err := svc.Submit(context.Background(), sessionID, uuid.New(), uuid.New(), uuid.New(), control)
	if err != nil {
		t.Fatalf("Submit new: %v", err)
	}
	if !restDS.created {
		t.Fatal("expected REST Create")
	}
	if source != "WeatherApi" || state.Mode != ModeView {
		t.Fatalf("unexpected submit result source=%s mode=%s", source, state.Mode)
	}

	recordID := uuid.New()
	store.Set(sessionID, control.Name, &State{
		Mode: ModeEdit,
		CurrentRecord: map[string]interface{}{
			"id":   recordID.String(),
			"name": "Ada",
		},
		DirtyFields:    map[string]interface{}{"name": "Grace"},
		EntityID:       connectorID,
		DataSource:     "WeatherApi",
		DataSourceKind: string(databinding.DataSourceKindRest),
	})
	if _, err := svc.Update(context.Background(), sessionID, uuid.New(), uuid.New(), control, map[string]interface{}{"name": "Grace"}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	_, _, err = svc.Submit(context.Background(), sessionID, uuid.New(), uuid.New(), uuid.New(), control)
	if err != nil {
		t.Fatalf("Submit edit: %v", err)
	}
	if !restDS.updated {
		t.Fatal("expected REST Update")
	}
}

func TestLastSubmitAndUpdatesAndError(t *testing.T) {
	store := NewSessionStore()
	galleryStore := gallery.NewSessionStore()
	sessionID := uuid.New()
	entityID := uuid.New()
	recordID := uuid.New()
	galleryStore.Set(sessionID, "Gallery1", &gallery.State{
		Selected: map[string]interface{}{
			"recordId": recordID.String(),
			"entityId": entityID.String(),
			"version":  1,
			"Name":     "Alice",
		},
	})
	svc := NewService(store, &fakeRecordService{}, &fakeRecordService{}, nil, nil, galleryStore)
	control := testFormControl()
	tenantID := uuid.New()
	if _, err := svc.SetMode(context.Background(), sessionID, tenantID, uuid.New(), control, ModeEdit); err != nil {
		t.Fatalf("SetMode: %v", err)
	}
	if _, err := svc.Update(context.Background(), sessionID, tenantID, uuid.New(), control, map[string]interface{}{"Name": "Bob"}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	reader := NewReaderWithService(store, sessionID, svc)
	updates, ok := reader.ResolveReference("Form1.Updates")
	if !ok {
		t.Fatal("expected Updates")
	}
	updateMap, _ := updates.(map[string]interface{})
	if updateMap["Name"] != "Bob" {
		t.Fatalf("expected Updates.Name=Bob, got %#v", updates)
	}
	_, _, err := svc.Submit(context.Background(), sessionID, tenantID, uuid.New(), uuid.New(), control)
	if err != nil {
		t.Fatalf("Submit: %v", err)
	}
	last, ok := reader.ResolveReference("Form1.LastSubmit")
	if !ok {
		t.Fatal("expected LastSubmit")
	}
	lastMap, _ := last.(map[string]interface{})
	if lastMap["Name"] != "Bob" && lastMap["Name"] != "Updated" {
		t.Fatalf("expected LastSubmit name, got %#v", last)
	}
}

func TestGallerySyncSkipsDirtyEdit(t *testing.T) {
	store := NewSessionStore()
	galleryStore := gallery.NewSessionStore()
	sessionID := uuid.New()
	galleryStore.Set(sessionID, "Gallery1", &gallery.State{
		Selected: map[string]interface{}{"Name": "Alice", "recordId": uuid.New().String(), "entityId": uuid.New().String(), "version": 1},
	})
	svc := NewService(store, &fakeRecordService{}, &fakeRecordService{}, nil, nil, galleryStore)
	control := testFormControl()
	if _, err := svc.SetMode(context.Background(), sessionID, uuid.New(), uuid.New(), control, ModeEdit); err != nil {
		t.Fatalf("SetMode: %v", err)
	}
	if _, err := svc.Update(context.Background(), sessionID, uuid.New(), uuid.New(), control, map[string]interface{}{"Name": "Dirty"}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	galleryStore.Set(sessionID, "Gallery1", &gallery.State{
		Selected: map[string]interface{}{"Name": "Other", "recordId": uuid.New().String(), "entityId": uuid.New().String(), "version": 1},
	})
	updated := svc.SyncGallerySelection(sessionID, "Gallery1", []ControlMetadata{control})
	if len(updated) != 0 {
		t.Fatalf("expected dirty form not synced, got %#v", updated)
	}
	state, err := svc.Get(sessionID, control.Name)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if state.CurrentRecord["Name"] != "Dirty" {
		t.Fatalf("expected Dirty preserved, got %#v", state.CurrentRecord)
	}
}

func TestExplicitItemLiteralAndNewDefaults(t *testing.T) {
	store := NewSessionStore()
	entityID := uuid.New()
	schema := &fakeRecordService{
		schema: &records.EntitySchema{
			EntityID: entityID,
			Fields: []records.FieldSchema{
				{Name: "Name", FieldType: "text", IsRequired: true},
				{Name: "Age", FieldType: "number", IsRequired: false},
			},
		},
	}
	svc := NewService(store, schema, schema, &fakeBindingResolver{entityID: entityID, name: "Customers"}, nil, gallery.NewSessionStore())
	control := ControlMetadata{
		Name:        "Form1",
		ControlType: "form",
		Formulas:    []FormulaBinding{{PropertyName: "item", FormulaText: `{Name: "Pat"}`}},
		Properties: map[string]interface{}{
			"dataSource": "Customers",
			"mode":       map[string]interface{}{"value": "View"},
		},
	}
	state, err := svc.Load(context.Background(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), control)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if state.CurrentRecord["Name"] != "Pat" {
		t.Fatalf("expected explicit item Name=Pat, got %#v", state.CurrentRecord)
	}

	sessionID := uuid.New()
	control.Formulas = []FormulaBinding{{PropertyName: "item", FormulaText: "Gallery1.Selected"}}
	if _, err := svc.SetMode(context.Background(), sessionID, uuid.New(), uuid.New(), control, ModeNew); err != nil {
		t.Fatalf("NewForm: %v", err)
	}
	newState, err := svc.Get(sessionID, control.Name)
	if err != nil {
		t.Fatalf("Get new: %v", err)
	}
	if _, ok := newState.CurrentRecord["Name"]; !ok {
		t.Fatalf("expected schema default keys on New, got %#v", newState.CurrentRecord)
	}
}

func TestBuildStateReadsWrappedDataSource(t *testing.T) {
	store := NewSessionStore()
	connectorID := uuid.New()
	svc := NewService(
		store,
		&fakeRecordService{},
		&fakeRecordService{},
		&fakeBindingResolver{
			entityID: connectorID,
			name:     "GoSheetsOne",
			kind:     databinding.DataSourceKindGoogleSheets,
		},
		nil,
		gallery.NewSessionStore(),
	)
	control := ControlMetadata{
		Name:        "Form1",
		ControlType: "form",
		Formulas:    []FormulaBinding{{PropertyName: "item", FormulaText: "Defaults(GoSheetsOne)"}},
		Properties: map[string]interface{}{
			"dataSource": map[string]interface{}{"value": "GoSheetsOne"},
			"mode":       map[string]interface{}{"value": "New"},
		},
	}
	state, err := svc.Load(context.Background(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), control)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if state.DataSource != "GoSheetsOne" {
		t.Fatalf("expected data source GoSheetsOne, got %q", state.DataSource)
	}
	if state.DataSourceKind != string(databinding.DataSourceKindGoogleSheets) {
		t.Fatalf("expected google_sheets kind, got %q", state.DataSourceKind)
	}
	if state.Mode != ModeNew {
		t.Fatalf("expected New mode, got %s", state.Mode)
	}
}

func TestSubmitGoogleSheetsInfersWrappedDataSource(t *testing.T) {
	store := NewSessionStore()
	connectorID := uuid.New()
	sheetsDS := &fakeGoogleSheetsFormDataSource{}
	registry := databinding.NewDataSourceRegistry(nil).SetGoogleSheets(sheetsDS)
	svc := NewService(
		store,
		&fakeRecordService{},
		&fakeRecordService{},
		&fakeBindingResolver{
			entityID: connectorID,
			name:     "GoSheetsOne",
			kind:     databinding.DataSourceKindGoogleSheets,
		},
		registry,
		gallery.NewSessionStore(),
	)
	sessionID := uuid.New()
	control := ControlMetadata{
		Name:        "Form1",
		ControlType: "form",
		Formulas:    []FormulaBinding{{PropertyName: "item", FormulaText: "Defaults(GoSheetsOne)"}},
		Properties: map[string]interface{}{
			"dataSource": map[string]interface{}{"value": "GoSheetsOne"},
			"mode":       map[string]interface{}{"value": "New"},
		},
	}
	if _, err := svc.SetMode(context.Background(), sessionID, uuid.New(), uuid.New(), control, ModeNew); err != nil {
		t.Fatalf("SetMode: %v", err)
	}
	if _, err := svc.Update(context.Background(), sessionID, uuid.New(), uuid.New(), control, map[string]interface{}{"Column 1": "A"}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	_, source, err := svc.Submit(context.Background(), sessionID, uuid.New(), uuid.New(), uuid.New(), control)
	if err != nil {
		t.Fatalf("Submit: %v", err)
	}
	if !sheetsDS.created {
		t.Fatal("expected Google Sheets Create")
	}
	if source != "GoSheetsOne" {
		t.Fatalf("expected GoSheetsOne source, got %q", source)
	}
}

type fakeGoogleSheetsFormDataSource struct {
	created bool
}

func (f *fakeGoogleSheetsFormDataSource) Kind() databinding.DataSourceKind {
	return databinding.DataSourceKindGoogleSheets
}
func (f *fakeGoogleSheetsFormDataSource) Query(context.Context, databinding.QueryInput) (*databinding.QueryResult, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeGoogleSheetsFormDataSource) Get(context.Context, uuid.UUID, uuid.UUID, databinding.DataSourceKey, uuid.UUID) (*databinding.DataItem, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeGoogleSheetsFormDataSource) Create(_ context.Context, _, _ uuid.UUID, _ databinding.DataSourceKey, data map[string]interface{}) (*databinding.DataItem, error) {
	f.created = true
	item := databinding.DataItem{"id": uuid.New().String(), "Column 1": data["Column 1"]}
	return &item, nil
}
func (f *fakeGoogleSheetsFormDataSource) Update(context.Context, uuid.UUID, uuid.UUID, databinding.DataSourceKey, uuid.UUID, map[string]interface{}, int) (*databinding.DataItem, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeGoogleSheetsFormDataSource) Delete(context.Context, uuid.UUID, uuid.UUID, databinding.DataSourceKey, uuid.UUID) error {
	return errors.New("not implemented")
}

type fakeBindingResolver struct {
	entityID uuid.UUID
	name     string
	kind     databinding.DataSourceKind
}

func (f *fakeBindingResolver) Resolve(ctx context.Context, tenantID, appID uuid.UUID, dataSourceName string, overrides databinding.QueryOverrides) (*databinding.ResolvedBinding, databinding.QueryInput, error) {
	_ = ctx
	_ = tenantID
	_ = appID
	_ = overrides
	kind := f.kind
	if kind == "" {
		kind = databinding.DataSourceKindEntity
	}
	return &databinding.ResolvedBinding{
		Name:     f.name,
		Kind:     kind,
		EntityID: f.entityID,
	}, databinding.QueryInput{}, nil
}

