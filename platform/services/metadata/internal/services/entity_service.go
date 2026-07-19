package services

import (
	"context"
	"fmt"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/google/uuid"
)

var allowedFieldTypes = map[string]struct{}{
	"text":    {},
	"number":  {},
	"boolean": {},
	"date":    {},
	"lookup":  {},
}

type EntityService struct {
	store repositories.Store
}

func NewEntityService(store repositories.Store) *EntityService {
	return &EntityService{store: store}
}

func (s *EntityService) Create(ctx context.Context, tenantID, appID uuid.UUID, name, displayName string) (*models.Entity, error) {
	entity := &models.Entity{
		TenantID:      tenantID,
		ApplicationID: appID,
		Name:          name,
		DisplayName:   displayName,
	}
	sess := s.store.WithTenant(ctx, tenantID)
	if err := sess.Entities().Create(ctx, entity); err != nil {
		return nil, fmt.Errorf("create entity: %w", err)
	}
	return entity, nil
}

func (s *EntityService) Update(ctx context.Context, tenantID, id uuid.UUID, updates map[string]interface{}) (*models.Entity, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	entity, err := sess.Entities().GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get entity for update: %w", err)
	}
	if v, ok := updates["name"].(string); ok {
		entity.Name = v
	}
	if v, ok := updates["display_name"].(string); ok {
		entity.DisplayName = v
	}
	if err := sess.Entities().Update(ctx, entity); err != nil {
		return nil, fmt.Errorf("update entity: %w", err)
	}
	return entity, nil
}

func (s *EntityService) ListByApplication(ctx context.Context, tenantID, appID uuid.UUID, limit, offset int) ([]models.Entity, int64, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	if repo, ok := any(sess.Entities()).(byFieldRepo[models.Entity]); ok {
		items, err := repo.ListByField(ctx, "application_id", appID, limit, offset)
		if err != nil {
			return nil, 0, fmt.Errorf("list entities: %w", err)
		}
		return items, int64(len(items)), nil
	}
	items, err := sess.Entities().ListByTenant(ctx, tenantID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list entities: %w", err)
	}
	var filtered []models.Entity
	for _, item := range items {
		if item.ApplicationID == appID {
			filtered = append(filtered, item)
		}
	}
	return filtered, int64(len(filtered)), nil
}

// CreateField creates a new entity field. relatedEntityID must be non-nil when
// fieldType is "lookup" (many-to-one relationship) and is otherwise ignored.
func (s *EntityService) CreateField(ctx context.Context, tenantID, entityID uuid.UUID, name, displayName, fieldType string, relatedEntityID *uuid.UUID) (*models.EntityField, error) {
	if _, ok := allowedFieldTypes[fieldType]; !ok {
		return nil, fmt.Errorf("invalid field_type: %s", fieldType)
	}
	sess := s.store.WithTenant(ctx, tenantID)
	if fieldType == "lookup" {
		resolved, err := s.resolveRelatedEntity(ctx, sess, relatedEntityID)
		if err != nil {
			return nil, err
		}
		relatedEntityID = resolved
	} else {
		relatedEntityID = nil
	}
	field := &models.EntityField{
		TenantID:        tenantID,
		EntityID:        entityID,
		Name:            name,
		DisplayName:     displayName,
		FieldType:       fieldType,
		RelatedEntityID: relatedEntityID,
	}
	if err := sess.EntityFields().Create(ctx, field); err != nil {
		return nil, fmt.Errorf("create entity field: %w", err)
	}
	return field, nil
}

// resolveRelatedEntity validates that a related entity id was supplied and that it
// refers to an entity that exists within the current tenant.
func (s *EntityService) resolveRelatedEntity(ctx context.Context, sess repositories.TenantSession, relatedEntityID *uuid.UUID) (*uuid.UUID, error) {
	if relatedEntityID == nil || *relatedEntityID == uuid.Nil {
		return nil, fmt.Errorf("related_entity_id is required for lookup fields")
	}
	if _, err := sess.Entities().GetByID(ctx, *relatedEntityID); err != nil {
		return nil, fmt.Errorf("related entity not found: %w", err)
	}
	return relatedEntityID, nil
}

func (s *EntityService) UpdateField(ctx context.Context, tenantID, id uuid.UUID, updates map[string]interface{}) (*models.EntityField, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	field, err := sess.EntityFields().GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get entity field for update: %w", err)
	}
	if v, ok := updates["name"].(string); ok {
		field.Name = v
	}
	if v, ok := updates["display_name"].(string); ok {
		field.DisplayName = v
	}
	if v, ok := updates["field_type"].(string); ok {
		if _, ok := allowedFieldTypes[v]; !ok {
			return nil, fmt.Errorf("invalid field_type: %s", v)
		}
		field.FieldType = v
	}
	if v, ok := updates["related_entity_id"]; ok {
		relatedEntityID, _ := v.(*uuid.UUID)
		field.RelatedEntityID = relatedEntityID
	}
	if field.FieldType == "lookup" {
		resolved, err := s.resolveRelatedEntity(ctx, sess, field.RelatedEntityID)
		if err != nil {
			return nil, err
		}
		field.RelatedEntityID = resolved
	} else {
		field.RelatedEntityID = nil
	}
	if err := sess.EntityFields().Update(ctx, field); err != nil {
		return nil, fmt.Errorf("update entity field: %w", err)
	}
	return field, nil
}

func (s *EntityService) ListFields(ctx context.Context, tenantID, entityID uuid.UUID, limit, offset int) ([]models.EntityField, int64, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	if repo, ok := any(sess.EntityFields()).(byFieldRepo[models.EntityField]); ok {
		items, err := repo.ListByField(ctx, "entity_id", entityID, limit, offset)
		if err != nil {
			return nil, 0, fmt.Errorf("list entity fields: %w", err)
		}
		return items, int64(len(items)), nil
	}
	items, err := sess.EntityFields().ListByTenant(ctx, tenantID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list entity fields: %w", err)
	}
	var filtered []models.EntityField
	for _, item := range items {
		if item.EntityID == entityID {
			filtered = append(filtered, item)
		}
	}
	return filtered, int64(len(filtered)), nil
}

func (s *EntityService) loadEntitiesForApp(ctx context.Context, sess repositories.TenantSession, tenantID, appID uuid.UUID) ([]models.Entity, error) {
	if repo, ok := any(sess.Entities()).(byFieldRepo[models.Entity]); ok {
		return repo.ListByField(ctx, "application_id", appID, 0, 0)
	}
	items, err := sess.Entities().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return nil, err
	}
	var filtered []models.Entity
	for _, item := range items {
		if item.ApplicationID == appID {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

func (s *EntityService) loadFieldsForEntity(ctx context.Context, sess repositories.TenantSession, tenantID, entityID uuid.UUID) ([]models.EntityField, error) {
	if repo, ok := any(sess.EntityFields()).(byFieldRepo[models.EntityField]); ok {
		return repo.ListByField(ctx, "entity_id", entityID, 0, 0)
	}
	items, err := sess.EntityFields().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return nil, err
	}
	var filtered []models.EntityField
	for _, item := range items {
		if item.EntityID == entityID {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

func (s *EntityService) LoadEntitiesWithFields(ctx context.Context, tenantID, appID uuid.UUID) ([]models.Entity, []models.EntityField, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	entities, err := s.loadEntitiesForApp(ctx, sess, tenantID, appID)
	if err != nil {
		return nil, nil, fmt.Errorf("load entities: %w", err)
	}
	var allFields []models.EntityField
	for _, entity := range entities {
		fields, err := s.loadFieldsForEntity(ctx, sess, tenantID, entity.ID)
		if err != nil {
			return nil, nil, fmt.Errorf("load fields for entity %s: %w", entity.ID.String(), err)
		}
		allFields = append(allFields, fields...)
	}
	return entities, allFields, nil
}
