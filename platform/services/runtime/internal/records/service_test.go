package records

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

type fakeSchemaRepo struct {
	schemas map[uuid.UUID]*EntitySchema
}

func (f *fakeSchemaRepo) GetEntitySchema(_ context.Context, tenantID, entityID uuid.UUID) (*EntitySchema, error) {
	schema, ok := f.schemas[entityID]
	if !ok || schema.TenantID != tenantID {
		return nil, ErrEntityNotFound
	}
	return schema, nil
}

type fakeRecordRepo struct {
	mu      sync.Mutex
	records map[uuid.UUID]EntityRecord
}

func newFakeRecordRepo() *fakeRecordRepo {
	return &fakeRecordRepo{records: map[uuid.UUID]EntityRecord{}}
}

func (f *fakeRecordRepo) Create(_ context.Context, record *EntityRecord) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	copy := *record
	f.records[record.ID] = copy
	return nil
}

func (f *fakeRecordRepo) GetByID(_ context.Context, tenantID, entityID, recordID uuid.UUID) (*EntityRecord, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	record, ok := f.records[recordID]
	if !ok || record.TenantID != tenantID || record.EntityID != entityID || record.DeletedOn != nil {
		return nil, ErrNotFound
	}
	copy := record
	return &copy, nil
}

func (f *fakeRecordRepo) List(_ context.Context, tenantID, entityID uuid.UUID, opts ListOptions) ([]EntityRecord, int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	items := make([]EntityRecord, 0)
	for _, record := range f.records {
		if record.TenantID == tenantID && record.EntityID == entityID && record.DeletedOn == nil {
			if !MatchFilterExpr(record.Data, opts.FilterExpr) {
				continue
			}
			items = append(items, record)
		}
	}
	total := int64(len(items))
	if opts.Offset >= len(items) {
		return []EntityRecord{}, total, nil
	}
	end := opts.Offset + opts.Limit
	if opts.Limit <= 0 || end > len(items) {
		end = len(items)
	}
	return items[opts.Offset:end], total, nil
}

func (f *fakeRecordRepo) Update(_ context.Context, record *EntityRecord, expectedVersion int) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	existing, ok := f.records[record.ID]
	if !ok || existing.DeletedOn != nil {
		return ErrNotFound
	}
	if existing.Version != expectedVersion {
		return ErrVersionConflict
	}
	record.Version = existing.Version + 1
	f.records[record.ID] = *record
	return nil
}

func (f *fakeRecordRepo) SoftDelete(_ context.Context, tenantID, entityID, recordID, userID uuid.UUID) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	record, ok := f.records[recordID]
	if !ok || record.TenantID != tenantID || record.EntityID != entityID || record.DeletedOn != nil {
		return ErrNotFound
	}
	now := time.Now().UTC()
	record.DeletedOn = &now
	record.DeletedBy = &userID
	f.records[recordID] = record
	return nil
}

func testSchema(entityID, tenantID uuid.UUID) *EntitySchema {
	return &EntitySchema{
		EntityID: entityID,
		TenantID: tenantID,
		Name:     "customer",
		Fields: []FieldSchema{
			{Name: "name", FieldType: "text", IsRequired: true},
			{Name: "age", FieldType: "number", IsRequired: false},
			{Name: "active", FieldType: "boolean", IsRequired: false},
			{Name: "Status", FieldType: "text", IsRequired: false},
		},
	}
}

func TestServiceCreateReadUpdateDelete(t *testing.T) {
	tenantID := uuid.New()
	otherTenant := uuid.New()
	userID := uuid.New()
	entityID := uuid.New()

	schemaRepo := &fakeSchemaRepo{schemas: map[uuid.UUID]*EntitySchema{
		entityID: testSchema(entityID, tenantID),
	}}
	recordRepo := newFakeRecordRepo()
	svc := NewService(recordRepo, schemaRepo)
	ctx := context.Background()

	created, err := svc.Create(ctx, tenantID, userID, entityID, map[string]interface{}{
		"name": "Alice",
		"age":  30,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if created.Version != 1 {
		t.Fatalf("expected version 1, got %d", created.Version)
	}

	got, err := svc.Get(ctx, tenantID, entityID, created.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Data["name"] != "Alice" {
		t.Fatalf("unexpected data: %#v", got.Data)
	}

	_, err = svc.Get(ctx, otherTenant, entityID, created.ID)
	if err != ErrEntityNotFound {
		t.Fatalf("expected tenant isolation on read, got %v", err)
	}

	items, total, err := svc.List(ctx, otherTenant, entityID, ListOptions{Limit: 10})
	if err != ErrEntityNotFound {
		t.Fatalf("expected tenant isolation on list, got %v", err)
	}
	_ = items
	_ = total

	updated, err := svc.Update(ctx, tenantID, userID, entityID, created.ID, map[string]interface{}{
		"age": 31,
	}, created.Version)
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.Version != 2 {
		t.Fatalf("expected version 2, got %d", updated.Version)
	}
	if updated.Data["age"].(int) != 31 {
		t.Fatalf("unexpected age: %#v", updated.Data["age"])
	}

	if err := svc.Delete(ctx, tenantID, userID, entityID, created.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := svc.Get(ctx, tenantID, entityID, created.ID); err != ErrNotFound {
		t.Fatalf("expected not found after delete, got %v", err)
	}
}

func TestServiceValidationFailures(t *testing.T) {
	tenantID := uuid.New()
	userID := uuid.New()
	entityID := uuid.New()
	schemaRepo := &fakeSchemaRepo{schemas: map[uuid.UUID]*EntitySchema{
		entityID: testSchema(entityID, tenantID),
	}}
	svc := NewService(newFakeRecordRepo(), schemaRepo)
	ctx := context.Background()

	_, err := svc.Create(ctx, tenantID, userID, entityID, map[string]interface{}{
		"unknown": "value",
	})
	if err == nil {
		t.Fatal("expected unknown field error")
	}
	var validationErr *ValidationError
	if !asValidation(err, &validationErr) || validationErr.Field != "unknown" {
		t.Fatalf("expected unknown field validation error, got %v", err)
	}

	_, err = svc.Create(ctx, tenantID, userID, entityID, map[string]interface{}{
		"age": 10,
	})
	if err == nil {
		t.Fatal("expected required field error")
	}
	if !asValidation(err, &validationErr) || validationErr.Field != "name" {
		t.Fatalf("expected required field validation error, got %v", err)
	}
}

func TestServiceVersionConflict(t *testing.T) {
	tenantID := uuid.New()
	userID := uuid.New()
	entityID := uuid.New()
	schemaRepo := &fakeSchemaRepo{schemas: map[uuid.UUID]*EntitySchema{
		entityID: testSchema(entityID, tenantID),
	}}
	recordRepo := newFakeRecordRepo()
	svc := NewService(recordRepo, schemaRepo)
	ctx := context.Background()

	created, err := svc.Create(ctx, tenantID, userID, entityID, map[string]interface{}{"name": "Bob"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	_, err = svc.Update(ctx, tenantID, userID, entityID, created.ID, map[string]interface{}{
		"age": 40,
	}, created.Version+1)
	if err != ErrVersionConflict {
		t.Fatalf("expected version conflict, got %v", err)
	}
}

func TestValidateCreateDataTypes(t *testing.T) {
	schema := testSchema(uuid.New(), uuid.New())
	err := ValidateCreateData(schema, map[string]interface{}{
		"name":   "x",
		"active": "yes",
	})
	if err == nil {
		t.Fatal("expected boolean type validation error")
	}
}

func asValidation(err error, target **ValidationError) bool {
	if err == nil {
		return false
	}
	validationErr, ok := err.(*ValidationError)
	if !ok {
		return false
	}
	*target = validationErr
	return true
}

func TestServiceListFilterPaging(t *testing.T) {
	tenantID := uuid.New()
	userID := uuid.New()
	entityID := uuid.New()
	schemaRepo := &fakeSchemaRepo{schemas: map[uuid.UUID]*EntitySchema{
		entityID: testSchema(entityID, tenantID),
	}}
	recordRepo := newFakeRecordRepo()
	svc := NewService(recordRepo, schemaRepo)
	ctx := context.Background()

	for i, status := range []string{"Inactive", "Active", "Active", "Inactive", "Active"} {
		_, err := svc.Create(ctx, tenantID, userID, entityID, map[string]interface{}{
			"name":   "row",
			"Status": status,
			"age":    i,
		})
		if err != nil {
			t.Fatalf("create %d: %v", i, err)
		}
	}

	items, total, err := svc.List(ctx, tenantID, entityID, ListOptions{
		Limit:  1,
		Offset: 1,
		FilterExpr: FilterExpr{
			Combinator: "And",
			Leaves:     []FilterLeaf{{Field: "Status", Op: "=", Value: "Active"}},
		},
	})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if total != 3 {
		t.Fatalf("expected filtered total 3, got %d", total)
	}
	if len(items) != 1 {
		t.Fatalf("expected one page item, got %d", len(items))
	}
	if items[0].Data["Status"] != "Active" {
		t.Fatalf("unexpected item: %#v", items[0].Data)
	}
}
