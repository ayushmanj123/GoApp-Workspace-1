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
			if !records.MatchFilterExpr(record.Data, opts.FilterExpr) {
				continue
			}
			rows = append(rows, record)
		}
	}
	total := int64(len(rows))
	if opts.Offset < 0 {
		opts.Offset = 0
	}
	if opts.Offset >= len(rows) {
		return []records.EntityRecord{}, total, nil
	}
	end := len(rows)
	if opts.Limit > 0 {
		end = opts.Offset + opts.Limit
		if end > len(rows) {
			end = len(rows)
		}
	}
	return rows[opts.Offset:end], total, nil
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
	if len(query.FilterExpr.Leaves) != 1 || query.FilterExpr.Leaves[0].Field != "Status" || query.FilterExpr.Leaves[0].Value != "Active" {
		t.Fatalf("unexpected filters: %#v", query.FilterExpr)
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
		FilterExpr:     FilterExpr{Combinator: CombinatorAnd, Leaves: []ComparisonFilter{{Field: "Status", Op: OpEQ, Value: "Active"}}},
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

// TestEntityDataSourceSparseFilterPaging proves filter pushdown: matching rows
// beyond the old in-memory fetch window (200) still appear in Count/pages.
func TestEntityDataSourceSparseFilterPaging(t *testing.T) {
	tenantID := uuid.New()
	entityID := uuid.New()
	items := make([]records.EntityRecord, 0, 250)
	for i := 0; i < 245; i++ {
		items = append(items, records.EntityRecord{
			ID: uuid.New(), TenantID: tenantID, EntityID: entityID,
			Data: map[string]interface{}{"Name": "noise", "Status": "Other"},
		})
	}
	for i := 0; i < 5; i++ {
		items = append(items, records.EntityRecord{
			ID: uuid.New(), TenantID: tenantID, EntityID: entityID,
			Data: map[string]interface{}{"Name": "hit", "Status": "Rare"},
		})
	}
	source := NewEntityDataSource(newFakeRecordService(items))

	result, err := source.Query(context.Background(), QueryInput{
		TenantID:   tenantID,
		EntityID:   entityID,
		Limit:      2,
		Offset:     0,
		FilterExpr: FilterExpr{Combinator: CombinatorAnd, Leaves: []ComparisonFilter{{Field: "Status", Op: OpEQ, Value: "Rare"}}},
	})
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	if result.Count != 5 {
		t.Fatalf("expected filtered count 5 (beyond old 200-window), got %d", result.Count)
	}
	if len(result.Items) != 2 {
		t.Fatalf("expected page size 2, got %d", len(result.Items))
	}
	page2, err := source.Query(context.Background(), QueryInput{
		TenantID:   tenantID,
		EntityID:   entityID,
		Limit:      2,
		Offset:     2,
		FilterExpr: FilterExpr{Combinator: CombinatorAnd, Leaves: []ComparisonFilter{{Field: "Status", Op: OpEQ, Value: "Rare"}}},
	})
	if err != nil {
		t.Fatalf("page2: %v", err)
	}
	if page2.Count != 5 || len(page2.Items) != 2 {
		t.Fatalf("unexpected page2: count=%d items=%d", page2.Count, len(page2.Items))
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

func TestParseEqualsFilterAndForms(t *testing.T) {
	filters, err := ParseEqualsFilter(`Status='Active' And Region='West'`)
	if err != nil {
		t.Fatalf("infix And: %v", err)
	}
	if len(filters) != 2 || filters[0].Field != "Status" || filters[0].Value != "Active" ||
		filters[1].Field != "Region" || filters[1].Value != "West" {
		t.Fatalf("unexpected infix filters: %#v", filters)
	}

	filters, err = ParseEqualsFilter(`And(Status='Active', Region='West')`)
	if err != nil {
		t.Fatalf("And(): %v", err)
	}
	if len(filters) != 2 || filters[1].Value != "West" {
		t.Fatalf("unexpected And() filters: %#v", filters)
	}

	filters, err = ParseEqualsFilter(`Status='Active'`)
	if err != nil || len(filters) != 1 {
		t.Fatalf("single: %#v %v", filters, err)
	}
}

func TestParseFilterExprOrAndComparisons(t *testing.T) {
	expr, err := ParseFilterExpr(`Status='A' Or Status='B'`)
	if err != nil {
		t.Fatalf("infix Or: %v", err)
	}
	if expr.Combinator != CombinatorOr || len(expr.Leaves) != 2 {
		t.Fatalf("unexpected Or expr: %#v", expr)
	}

	expr, err = ParseFilterExpr(`Or(Status='A', Status='B')`)
	if err != nil {
		t.Fatalf("Or(): %v", err)
	}
	if expr.Combinator != CombinatorOr || len(expr.Leaves) != 2 {
		t.Fatalf("unexpected Or() expr: %#v", expr)
	}

	expr, err = ParseFilterExpr(`Amount>10`)
	if err != nil {
		t.Fatalf("comparison: %v", err)
	}
	if len(expr.Leaves) != 1 || expr.Leaves[0].Op != OpGT || expr.Leaves[0].Value != "10" {
		t.Fatalf("unexpected comparison: %#v", expr)
	}

	expr, err = ParseFilterExpr(`Status<>'X'`)
	if err != nil || expr.Leaves[0].Op != OpNE {
		t.Fatalf("ne: %#v %v", expr, err)
	}

	_, err = ParseFilterExpr(`Status='A' And Region='B' Or Status='C'`)
	if err == nil {
		t.Fatal("expected mixed And/Or to fail")
	}
}

func TestParseFilterExprContainsStartsWith(t *testing.T) {
	expr, err := ParseFilterExpr(`Contains(Name,'ac')`)
	if err != nil {
		t.Fatalf("Contains(ac): %v", err)
	}
	if len(expr.Leaves) != 1 || expr.Leaves[0].Op != OpContains || expr.Leaves[0].Field != "Name" || expr.Leaves[0].Value != "ac" {
		t.Fatalf("unexpected Contains(ac) expr: %#v", expr)
	}

	expr, err = ParseFilterExpr(`Contains(Name,'acme')`)
	if err != nil {
		t.Fatalf("Contains: %v", err)
	}
	if len(expr.Leaves) != 1 || expr.Leaves[0].Op != OpContains || expr.Leaves[0].Field != "Name" || expr.Leaves[0].Value != "acme" {
		t.Fatalf("unexpected Contains expr: %#v", expr)
	}
	expr, err = ParseFilterExpr(`StartsWith(Name,"A")`)
	if err != nil {
		t.Fatalf("StartsWith: %v", err)
	}
	if expr.Leaves[0].Op != OpStartsWith || expr.Leaves[0].Value != "A" {
		t.Fatalf("unexpected StartsWith expr: %#v", expr)
	}
	row := map[string]interface{}{"Name": "Acme Corp"}
	if !MatchFilterExpr(row, FilterExpr{Leaves: []ComparisonFilter{{Field: "Name", Op: OpContains, Value: "acme"}}}) {
		t.Fatal("expected contains match")
	}
	if !MatchFilterExpr(row, FilterExpr{Leaves: []ComparisonFilter{{Field: "Name", Op: OpStartsWith, Value: "ac"}}}) {
		t.Fatal("expected startswith match")
	}
	if MatchFilterExpr(row, FilterExpr{Leaves: []ComparisonFilter{{Field: "Name", Op: OpStartsWith, Value: "zz"}}}) {
		t.Fatal("expected startswith miss")
	}
}

func TestMatchFilterExprOrAndComparisons(t *testing.T) {
	row := map[string]interface{}{"Status": "Active", "Amount": float64(20)}
	orExpr, _ := ParseFilterExpr(`Status='Missing' Or Status='Active'`)
	if !MatchFilterExpr(row, orExpr) {
		t.Fatal("expected Or match")
	}
	neExpr, _ := ParseFilterExpr(`Status<>'Inactive'`)
	if !MatchFilterExpr(row, neExpr) {
		t.Fatal("expected <> match")
	}
	gtExpr, _ := ParseFilterExpr(`Amount>10`)
	if !MatchFilterExpr(row, gtExpr) {
		t.Fatal("expected > match")
	}
	miss, _ := ParseFilterExpr(`Amount>100`)
	if MatchFilterExpr(row, miss) {
		t.Fatal("expected > miss")
	}
}

func TestEntityDataSourceOrFilter(t *testing.T) {
	tenantID := uuid.New()
	entityID := uuid.New()
	recordsSvc := newFakeRecordService([]records.EntityRecord{
		{ID: uuid.New(), TenantID: tenantID, EntityID: entityID, Data: map[string]interface{}{"Name": "Alice", "Status": "Active"}},
		{ID: uuid.New(), TenantID: tenantID, EntityID: entityID, Data: map[string]interface{}{"Name": "Bob", "Status": "Pending"}},
		{ID: uuid.New(), TenantID: tenantID, EntityID: entityID, Data: map[string]interface{}{"Name": "Cara", "Status": "Inactive"}},
	})
	source := NewEntityDataSource(recordsSvc)
	expr, err := ParseFilterExpr(`Status='Active' Or Status='Pending'`)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	result, err := source.Query(context.Background(), QueryInput{
		TenantID:   tenantID,
		EntityID:   entityID,
		Limit:      50,
		FilterExpr: expr,
	})
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	if result.Count != 2 {
		t.Fatalf("expected 2 matches, got %d", result.Count)
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
