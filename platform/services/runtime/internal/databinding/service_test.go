package databinding

import (
	"context"
	"sync"
	"testing"

	"github.com/goapps-platform/runtime-service/internal/records"
	"github.com/google/uuid"
)

type fakeMetadataRepo struct {
	bindings map[string]*ResolvedBinding
}

func (f *fakeMetadataRepo) key(appID uuid.UUID, name string) string {
	return appID.String() + ":" + name
}

func (f *fakeMetadataRepo) ResolveEntity(_ context.Context, tenantID, appID uuid.UUID, dataSourceName string) (*ResolvedBinding, error) {
	binding, ok := f.bindings[f.key(appID, dataSourceName)]
	if !ok || binding.EntityID == uuid.Nil {
		return nil, ErrDataSourceNotFound
	}
	copy := *binding
	copy.Metadata.DataSource = dataSourceName
	return &copy, nil
}

func (f *fakeMetadataRepo) LoadBindingMetadata(_ context.Context, tenantID, appID uuid.UUID, dataSourceName string) (*ControlBindingMetadata, error) {
	binding, ok := f.bindings[f.key(appID, dataSourceName)]
	if !ok {
		return nil, ErrDataSourceNotFound
	}
	meta := binding.Metadata
	return &meta, nil
}

type fakeRecordService struct {
	mu      sync.Mutex
	records map[uuid.UUID]records.EntityRecord
}

func newFakeRecordService(items []records.EntityRecord) *fakeRecordService {
	store := map[uuid.UUID]records.EntityRecord{}
	for _, item := range items {
		store[item.ID] = item
	}
	return &fakeRecordService{records: store}
}

func (f *fakeRecordService) List(_ context.Context, tenantID, entityID uuid.UUID, opts records.ListOptions) ([]records.EntityRecord, int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	rows := make([]records.EntityRecord, 0)
	for _, record := range f.records {
		if record.TenantID == tenantID && record.EntityID == entityID {
			rows = append(rows, record)
		}
	}
	return rows, int64(len(rows)), nil
}

func (f *fakeRecordService) Get(_ context.Context, tenantID, entityID, recordID uuid.UUID) (*records.EntityRecord, error) {
	record, ok := f.records[recordID]
	if !ok || record.TenantID != tenantID || record.EntityID != entityID {
		return nil, records.ErrNotFound
	}
	copy := record
	return &copy, nil
}

func (f *fakeRecordService) Create(context.Context, uuid.UUID, uuid.UUID, uuid.UUID, map[string]interface{}) (*records.EntityRecord, error) {
	panic("not implemented")
}

func (f *fakeRecordService) Update(context.Context, uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID, map[string]interface{}, int) (*records.EntityRecord, error) {
	panic("not implemented")
}

func (f *fakeRecordService) Delete(context.Context, uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID) error {
	panic("not implemented")
}

func TestResolverEntityResolutionAndFilterPaging(t *testing.T) {
	tenantID := uuid.New()
	appID := uuid.New()
	entityID := uuid.New()

	metadata := &fakeMetadataRepo{bindings: map[string]*ResolvedBinding{
		appID.String() + ":Customers": {
			EntityID: entityID,
			Kind:     DataSourceKindEntity,
			Metadata: ControlBindingMetadata{
				DataSource: "Customers",
				Filter:     "Status='Active'",
				Sort:       "Name",
				Limit:      10,
			},
		},
	}}
	resolver := NewResolver(metadata)

	binding, query, err := resolver.Resolve(context.Background(), tenantID, appID, "Customers", QueryOverrides{Offset: 1})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if binding.EntityID != entityID {
		t.Fatalf("unexpected entity id")
	}
	if len(query.Filters) != 1 || query.Filters[0].Field != "Status" || query.Filters[0].Value != "Active" {
		t.Fatalf("unexpected filters: %#v", query.Filters)
	}
	if query.OrderBy != "Name" || query.OrderDirection != "asc" {
		t.Fatalf("unexpected sort: %s %s", query.OrderBy, query.OrderDirection)
	}
	if query.Limit != 10 || query.Offset != 1 {
		t.Fatalf("unexpected paging: %d %d", query.Limit, query.Offset)
	}
}

func TestEntityDataSourceFilterSortPaging(t *testing.T) {
	tenantID := uuid.New()
	entityID := uuid.New()
	recordsSvc := newFakeRecordService([]records.EntityRecord{
		{ID: uuid.New(), TenantID: tenantID, EntityID: entityID, Data: map[string]interface{}{"Name": "Alice", "Status": "Active"}},
		{ID: uuid.New(), TenantID: tenantID, EntityID: entityID, Data: map[string]interface{}{"Name": "Bob", "Status": "Active"}},
		{ID: uuid.New(), TenantID: tenantID, EntityID: entityID, Data: map[string]interface{}{"Name": "Cara", "Status": "Inactive"}},
	})
	source := NewEntityDataSource(recordsSvc)

	result, err := source.Query(context.Background(), QueryInput{
		TenantID:       tenantID,
		EntityID:       entityID,
		Limit:          1,
		Offset:         1,
		Filters:        []EqualsFilter{{Field: "Status", Value: "Active"}},
		OrderBy:        "created_on",
		OrderDirection: "asc",
	})
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	if result.Count != 2 {
		t.Fatalf("expected filtered count 2, got %d", result.Count)
	}
	if len(result.Items) != 1 {
		t.Fatalf("expected one paged item, got %d", len(result.Items))
	}
}

func TestServiceRequestCache(t *testing.T) {
	tenantID := uuid.New()
	appID := uuid.New()
	entityID := uuid.New()
	userID := uuid.New()
	listCalls := 0

	metadata := &fakeMetadataRepo{bindings: map[string]*ResolvedBinding{
		appID.String() + ":Customers": {
			EntityID: entityID,
			Kind:     DataSourceKindEntity,
			Metadata: ControlBindingMetadata{DataSource: "Customers", Limit: 50},
		},
	}}
	recordsSvc := &countingRecordService{
		inner: newFakeRecordService([]records.EntityRecord{
			{ID: uuid.New(), TenantID: tenantID, EntityID: entityID, Data: map[string]interface{}{"Name": "Alice"}},
		}),
		onList: func() { listCalls++ },
	}
	svc := NewService(NewResolver(metadata), NewDataSourceRegistry(NewEntityDataSource(recordsSvc)))

	ctx := WithRequestCache(context.Background())
	first, err := svc.QueryDataSource(ctx, tenantID, userID, appID, "Customers", QueryOverrides{})
	if err != nil {
		t.Fatalf("first query: %v", err)
	}
	second, err := svc.QueryDataSource(ctx, tenantID, userID, appID, "Customers", QueryOverrides{})
	if err != nil {
		t.Fatalf("second query: %v", err)
	}
	if listCalls != 1 {
		t.Fatalf("expected one list call due to cache, got %d", listCalls)
	}
	if first.Count != second.Count || len(first.Items) != len(second.Items) {
		t.Fatalf("cached result mismatch")
	}
}

func TestInvalidDataSource(t *testing.T) {
	svc := NewService(NewResolver(&fakeMetadataRepo{bindings: map[string]*ResolvedBinding{}}), NewDataSourceRegistry(NewEntityDataSource(newFakeRecordService(nil))))
	_, err := svc.QueryDataSource(context.Background(), uuid.New(), uuid.New(), uuid.New(), "Missing", QueryOverrides{})
	if err != ErrDataSourceNotFound {
		t.Fatalf("expected datasource not found, got %v", err)
	}
}

func TestParseEqualsFilterInvalid(t *testing.T) {
	_, err := ParseEqualsFilter("Status = Active")
	if err == nil {
		t.Fatal("expected invalid filter error")
	}
}

type countingRecordService struct {
	inner  RecordService
	onList func()
}

func (c *countingRecordService) List(ctx context.Context, tenantID, entityID uuid.UUID, opts records.ListOptions) ([]records.EntityRecord, int64, error) {
	if c.onList != nil {
		c.onList()
	}
	return c.inner.List(ctx, tenantID, entityID, opts)
}

func (c *countingRecordService) Get(ctx context.Context, tenantID, entityID, recordID uuid.UUID) (*records.EntityRecord, error) {
	return c.inner.Get(ctx, tenantID, entityID, recordID)
}

func (c *countingRecordService) Create(ctx context.Context, tenantID, userID, entityID uuid.UUID, data map[string]interface{}) (*records.EntityRecord, error) {
	return c.inner.Create(ctx, tenantID, userID, entityID, data)
}

func (c *countingRecordService) Update(ctx context.Context, tenantID, userID, entityID, recordID uuid.UUID, data map[string]interface{}, version int) (*records.EntityRecord, error) {
	return c.inner.Update(ctx, tenantID, userID, entityID, recordID, data, version)
}

func (c *countingRecordService) Delete(ctx context.Context, tenantID, userID, entityID, recordID uuid.UUID) error {
	return c.inner.Delete(ctx, tenantID, userID, entityID, recordID)
}
