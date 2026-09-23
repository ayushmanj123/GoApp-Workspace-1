package records

import (
	"context"
	"fmt"
	"strings"
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
	links   map[string]struct{} // key: rel|left|right
	rels    map[uuid.UUID][2]uuid.UUID
}

func newFakeRecordRepo() *fakeRecordRepo {
	return &fakeRecordRepo{
		records: map[uuid.UUID]EntityRecord{},
		links:   map[string]struct{}{},
		rels:    map[uuid.UUID][2]uuid.UUID{},
	}
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

func valuesEqual(a, b interface{}) bool {
	return fmt.Sprintf("%v", a) == fmt.Sprintf("%v", b)
}

func (f *fakeRecordRepo) ExistsWithFieldValue(_ context.Context, tenantID, entityID uuid.UUID, fieldName string, value interface{}, excludeRecordID *uuid.UUID) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, record := range f.records {
		if record.TenantID != tenantID || record.EntityID != entityID || record.DeletedOn != nil {
			continue
		}
		if excludeRecordID != nil && record.ID == *excludeRecordID {
			continue
		}
		if valuesEqual(record.Data[fieldName], value) {
			return true, nil
		}
	}
	return false, nil
}

func (f *fakeRecordRepo) ExistsWithKeyValues(_ context.Context, tenantID, entityID uuid.UUID, fieldNames []string, data map[string]interface{}, excludeRecordID *uuid.UUID) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, record := range f.records {
		if record.TenantID != tenantID || record.EntityID != entityID || record.DeletedOn != nil {
			continue
		}
		if excludeRecordID != nil && record.ID == *excludeRecordID {
			continue
		}
		match := true
		for _, name := range fieldNames {
			if !valuesEqual(record.Data[name], data[name]) {
				match = false
				break
			}
		}
		if match {
			return true, nil
		}
	}
	return false, nil
}

func linkKey(rel, left, right uuid.UUID) string {
	return rel.String() + "|" + left.String() + "|" + right.String()
}

func (f *fakeRecordRepo) AssociateLinks(_ context.Context, tenantID, relationshipID, leftID, rightID, _ uuid.UUID) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.links[linkKey(relationshipID, leftID, rightID)] = struct{}{}
	_ = tenantID
	return nil
}

func (f *fakeRecordRepo) DisassociateLinks(_ context.Context, tenantID, relationshipID, leftID, rightID, _ uuid.UUID) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.links, linkKey(relationshipID, leftID, rightID))
	_ = tenantID
	return nil
}

func (f *fakeRecordRepo) ListLinkedRecordIDs(_ context.Context, tenantID, relationshipID, recordID uuid.UUID, fromLeft bool) ([]uuid.UUID, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	_ = tenantID
	out := []uuid.UUID{}
	prefix := relationshipID.String() + "|"
	for k := range f.links {
		if !strings.HasPrefix(k, prefix) {
			continue
		}
		parts := strings.Split(k, "|")
		if len(parts) != 3 {
			continue
		}
		left, _ := uuid.Parse(parts[1])
		right, _ := uuid.Parse(parts[2])
		if fromLeft && left == recordID {
			out = append(out, right)
		}
		if !fromLeft && right == recordID {
			out = append(out, left)
		}
	}
	return out, nil
}

func (f *fakeRecordRepo) RelationshipExists(_ context.Context, tenantID, relationshipID uuid.UUID) (bool, uuid.UUID, uuid.UUID, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	_ = tenantID
	ends, ok := f.rels[relationshipID]
	if !ok {
		return false, uuid.Nil, uuid.Nil, nil
	}
	return true, ends[0], ends[1], nil
}

func (f *fakeRecordRepo) registerRel(id, left, right uuid.UUID) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.rels[id] = [2]uuid.UUID{left, right}
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

func TestServiceUniquenessAndAlternateKey(t *testing.T) {
	tenantID := uuid.New()
	userID := uuid.New()
	entityID := uuid.New()
	schema := &EntitySchema{
		EntityID: entityID,
		TenantID: tenantID,
		Name:     "account",
		Fields: []FieldSchema{
			{Name: "email", FieldType: "email", IsRequired: true, IsUnique: true},
			{Name: "code", FieldType: "text", IsRequired: true},
		},
		Keys: []EntityKeySchema{{Name: "ak_code", FieldNames: []string{"code"}}},
	}
	schemaRepo := &fakeSchemaRepo{schemas: map[uuid.UUID]*EntitySchema{entityID: schema}}
	repo := newFakeRecordRepo()
	svc := NewService(repo, schemaRepo)
	ctx := context.Background()

	_, err := svc.Create(ctx, tenantID, userID, entityID, map[string]interface{}{
		"email": "a@example.com",
		"code":  "C1",
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	_, err = svc.Create(ctx, tenantID, userID, entityID, map[string]interface{}{
		"email": "a@example.com",
		"code":  "C2",
	})
	var validationErr *ValidationError
	if !asValidation(err, &validationErr) || validationErr.Field != "email" {
		t.Fatalf("expected unique email conflict, got %v", err)
	}

	_, err = svc.Create(ctx, tenantID, userID, entityID, map[string]interface{}{
		"email": "b@example.com",
		"code":  "C1",
	})
	if !asValidation(err, &validationErr) || validationErr.Field != "ak_code" {
		t.Fatalf("expected alternate key conflict, got %v", err)
	}
}

func TestServiceImportCSVDryRun(t *testing.T) {
	tenantID := uuid.New()
	userID := uuid.New()
	entityID := uuid.New()
	schemaRepo := &fakeSchemaRepo{schemas: map[uuid.UUID]*EntitySchema{
		entityID: testSchema(entityID, tenantID),
	}}
	repo := newFakeRecordRepo()
	svc := NewService(repo, schemaRepo)
	ctx := context.Background()

	csvBody := "Name,Age\nAlice,30\n,bad\n"
	result, err := svc.ImportCSV(ctx, tenantID, userID, entityID, strings.NewReader(csvBody), map[string]string{
		"Name": "name",
		"Age":  "age",
	}, true)
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	if !result.DryRun {
		t.Fatal("expected dry run")
	}
	if result.Created < 1 {
		t.Fatalf("expected at least one ok row, got %+v", result)
	}
	if result.Failed < 1 {
		t.Fatalf("expected at least one failed row, got %+v", result)
	}
	if len(repo.records) != 0 {
		t.Fatalf("dry run must not persist records, got %d", len(repo.records))
	}
}

func TestServiceAssociateDisassociate(t *testing.T) {
	tenantID := uuid.New()
	userID := uuid.New()
	relID := uuid.New()
	leftID := uuid.New()
	rightID := uuid.New()
	repo := newFakeRecordRepo()
	repo.registerRel(relID, uuid.New(), uuid.New())
	svc := NewService(repo, &fakeSchemaRepo{schemas: map[uuid.UUID]*EntitySchema{}})
	ctx := context.Background()

	if err := svc.Associate(ctx, tenantID, userID, relID, leftID, rightID); err != nil {
		t.Fatalf("associate: %v", err)
	}
	ids, err := svc.ListRelated(ctx, tenantID, relID, leftID, true)
	if err != nil {
		t.Fatalf("listRelated: %v", err)
	}
	if len(ids) != 1 || ids[0] != rightID {
		t.Fatalf("unexpected related: %#v", ids)
	}
	if err := svc.Disassociate(ctx, tenantID, userID, relID, leftID, rightID); err != nil {
		t.Fatalf("disassociate: %v", err)
	}
	ids, err = svc.ListRelated(ctx, tenantID, relID, leftID, true)
	if err != nil {
		t.Fatalf("listRelated after: %v", err)
	}
	if len(ids) != 0 {
		t.Fatalf("expected no links, got %#v", ids)
	}
}

