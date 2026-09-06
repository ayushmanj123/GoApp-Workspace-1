package services

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

var allowedFieldTypes = map[string]struct{}{
	"text":      {},
	"number":    {},
	"boolean":   {},
	"date":      {},
	"lookup":    {},
	"multiline": {},
	"email":     {},
	"phone":     {},
	"url":       {},
	"integer":   {},
	"decimal":   {},
	"currency":  {},
	"datetime":  {},
	"choice":    {},
	"choices":   {},
}

var allowedDeleteBehaviors = map[string]struct{}{
	"restrict": {},
	"clear":    {},
	"cascade":  {},
}

// FieldTypeOneOf is the validator oneof list for entity field types.
const FieldTypeOneOf = "text number boolean date lookup multiline email phone url integer decimal currency datetime choice choices"

type EntityService struct {
	store repositories.Store
}

func NewEntityService(store repositories.Store) *EntityService {
	return &EntityService{store: store}
}

type CreateEntityInput struct {
	Name              string
	DisplayName       string
	PluralDisplayName string
	Description       string
	CreatePrimaryName bool
}

func (s *EntityService) Create(ctx context.Context, tenantID, appID uuid.UUID, in CreateEntityInput) (*models.Entity, error) {
	plural := in.PluralDisplayName
	if plural == "" {
		plural = in.DisplayName + "s"
	}
	entity := &models.Entity{
		TenantID:          tenantID,
		ApplicationID:     appID,
		Name:              in.Name,
		DisplayName:       in.DisplayName,
		PluralDisplayName: plural,
		Description:       in.Description,
	}
	sess := s.store.WithTenant(ctx, tenantID)
	if err := sess.Entities().Create(ctx, entity); err != nil {
		return nil, fmt.Errorf("create entity: %w", err)
	}
	if in.CreatePrimaryName {
		field, err := s.CreateField(ctx, tenantID, entity.ID, CreateFieldInput{
			Name:        "Name",
			DisplayName: "Name",
			FieldType:   "text",
			IsRequired:  true,
		})
		if err != nil {
			return nil, fmt.Errorf("create primary field: %w", err)
		}
		entity.PrimaryFieldID = &field.ID
		if err := sess.Entities().Update(ctx, entity); err != nil {
			return nil, fmt.Errorf("set primary field: %w", err)
		}
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
	if v, ok := updates["plural_display_name"].(string); ok {
		entity.PluralDisplayName = v
	}
	if v, ok := updates["description"].(string); ok {
		entity.Description = v
	}
	if v, ok := updates["primary_field_id"]; ok {
		entity.PrimaryFieldID, _ = v.(*uuid.UUID)
		if entity.PrimaryFieldID != nil {
			field, err := sess.EntityFields().GetByID(ctx, *entity.PrimaryFieldID)
			if err != nil || field.EntityID != entity.ID {
				return nil, fmt.Errorf("primary_field_id must belong to this entity")
			}
		}
	}
	if err := sess.Entities().Update(ctx, entity); err != nil {
		return nil, fmt.Errorf("update entity: %w", err)
	}
	return entity, nil
}

func (s *EntityService) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	sess := s.store.WithTenant(ctx, tenantID)
	entity, err := sess.Entities().GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("get entity for delete: %w", err)
	}
	// Block delete when other entities have lookup fields pointing here.
	allFields, err := sess.EntityFields().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return fmt.Errorf("list fields for delete check: %w", err)
	}
	for _, f := range allFields {
		if f.RelatedEntityID != nil && *f.RelatedEntityID == id && f.DeleteBehavior == "restrict" {
			return fmt.Errorf("entity is referenced by lookup field %q (delete_behavior=restrict)", f.Name)
		}
	}
	// Soft-delete fields of this entity first.
	fields, err := s.loadFieldsForEntity(ctx, sess, tenantID, entity.ID)
	if err != nil {
		return err
	}
	for _, f := range fields {
		_ = sess.EntityFields().Delete(ctx, f.ID)
	}
	keys, _ := s.ListKeys(ctx, tenantID, entity.ID, 0, 0)
	for _, k := range keys {
		_ = sess.EntityKeys().Delete(ctx, k.ID)
	}
	return sess.Entities().Delete(ctx, id)
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

// CreateFieldInput carries field create options.
type CreateFieldInput struct {
	Name            string
	DisplayName     string
	FieldType       string
	IsRequired      bool
	IsUnique        bool
	RelatedEntityID *uuid.UUID
	Options         []string
	ConfigJSON      json.RawMessage
	DeleteBehavior  string
}

func (s *EntityService) CreateField(ctx context.Context, tenantID, entityID uuid.UUID, in CreateFieldInput) (*models.EntityField, error) {
	if _, ok := allowedFieldTypes[in.FieldType]; !ok {
		return nil, fmt.Errorf("invalid field_type: %s", in.FieldType)
	}
	sess := s.store.WithTenant(ctx, tenantID)
	relatedEntityID := in.RelatedEntityID
	if in.FieldType == "lookup" {
		resolved, err := s.resolveRelatedEntity(ctx, sess, relatedEntityID)
		if err != nil {
			return nil, err
		}
		relatedEntityID = resolved
	} else {
		relatedEntityID = nil
	}
	behavior := in.DeleteBehavior
	if behavior == "" {
		behavior = "restrict"
	}
	if _, ok := allowedDeleteBehaviors[behavior]; !ok {
		return nil, fmt.Errorf("invalid delete_behavior: %s", behavior)
	}
	if (in.FieldType == "choice" || in.FieldType == "choices") && len(in.Options) == 0 {
		return nil, fmt.Errorf("options are required for choice fields")
	}
	var optionsJSON datatypes.JSON
	if len(in.Options) > 0 {
		b, err := json.Marshal(in.Options)
		if err != nil {
			return nil, fmt.Errorf("marshal options: %w", err)
		}
		optionsJSON = datatypes.JSON(b)
	}
	var configJSON datatypes.JSON
	if len(in.ConfigJSON) > 0 {
		configJSON = datatypes.JSON(in.ConfigJSON)
	}
	field := &models.EntityField{
		TenantID:        tenantID,
		EntityID:        entityID,
		Name:            in.Name,
		DisplayName:     in.DisplayName,
		FieldType:       in.FieldType,
		IsRequired:      in.IsRequired,
		IsUnique:        in.IsUnique,
		RelatedEntityID: relatedEntityID,
		OptionsJSON:     optionsJSON,
		ConfigJSON:      configJSON,
		DeleteBehavior:  behavior,
	}
	if err := sess.EntityFields().Create(ctx, field); err != nil {
		return nil, fmt.Errorf("create entity field: %w", err)
	}
	return field, nil
}

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
	if v, ok := updates["is_required"].(bool); ok {
		field.IsRequired = v
	}
	if v, ok := updates["is_unique"].(bool); ok {
		field.IsUnique = v
	}
	if v, ok := updates["delete_behavior"].(string); ok {
		if _, ok := allowedDeleteBehaviors[v]; !ok {
			return nil, fmt.Errorf("invalid delete_behavior: %s", v)
		}
		field.DeleteBehavior = v
	}
	if v, ok := updates["related_entity_id"]; ok {
		relatedEntityID, _ := v.(*uuid.UUID)
		field.RelatedEntityID = relatedEntityID
	}
	if v, ok := updates["options"].([]string); ok {
		b, err := json.Marshal(v)
		if err != nil {
			return nil, fmt.Errorf("marshal options: %w", err)
		}
		field.OptionsJSON = datatypes.JSON(b)
	}
	if v, ok := updates["config_json"].(json.RawMessage); ok {
		field.ConfigJSON = datatypes.JSON(v)
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

func (s *EntityService) DeleteField(ctx context.Context, tenantID, id uuid.UUID) error {
	sess := s.store.WithTenant(ctx, tenantID)
	field, err := sess.EntityFields().GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("get entity field for delete: %w", err)
	}
	entity, err := sess.Entities().GetByID(ctx, field.EntityID)
	if err != nil {
		return fmt.Errorf("get entity for field delete: %w", err)
	}
	if entity.PrimaryFieldID != nil && *entity.PrimaryFieldID == id {
		return fmt.Errorf("cannot delete the primary column")
	}
	return sess.EntityFields().Delete(ctx, id)
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

func (s *EntityService) CreateKey(ctx context.Context, tenantID, entityID uuid.UUID, name string, fieldIDs []uuid.UUID) (*models.EntityKey, error) {
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if len(fieldIDs) == 0 {
		return nil, fmt.Errorf("field_ids is required")
	}
	sess := s.store.WithTenant(ctx, tenantID)
	if _, err := sess.Entities().GetByID(ctx, entityID); err != nil {
		return nil, fmt.Errorf("entity not found: %w", err)
	}
	for _, fid := range fieldIDs {
		field, err := sess.EntityFields().GetByID(ctx, fid)
		if err != nil || field.EntityID != entityID {
			return nil, fmt.Errorf("field %s does not belong to entity", fid)
		}
	}
	b, err := json.Marshal(fieldIDs)
	if err != nil {
		return nil, err
	}
	key := &models.EntityKey{
		TenantID: tenantID,
		EntityID: entityID,
		Name:     name,
		FieldIDs: datatypes.JSON(b),
	}
	if err := sess.EntityKeys().Create(ctx, key); err != nil {
		return nil, fmt.Errorf("create entity key: %w", err)
	}
	return key, nil
}

func (s *EntityService) ListKeys(ctx context.Context, tenantID, entityID uuid.UUID, limit, offset int) ([]models.EntityKey, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	if repo, ok := any(sess.EntityKeys()).(byFieldRepo[models.EntityKey]); ok {
		return repo.ListByField(ctx, "entity_id", entityID, limit, offset)
	}
	items, err := sess.EntityKeys().ListByTenant(ctx, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	var filtered []models.EntityKey
	for _, item := range items {
		if item.EntityID == entityID {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

func (s *EntityService) DeleteKey(ctx context.Context, tenantID, id uuid.UUID) error {
	sess := s.store.WithTenant(ctx, tenantID)
	if _, err := sess.EntityKeys().GetByID(ctx, id); err != nil {
		return err
	}
	return sess.EntityKeys().Delete(ctx, id)
}

func (s *EntityService) CreateRelationship(ctx context.Context, tenantID uuid.UUID, name string, leftEntityID, rightEntityID uuid.UUID) (*models.EntityRelationship, error) {
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if leftEntityID == rightEntityID {
		return nil, fmt.Errorf("left and right entities must differ")
	}
	sess := s.store.WithTenant(ctx, tenantID)
	if _, err := sess.Entities().GetByID(ctx, leftEntityID); err != nil {
		return nil, fmt.Errorf("left entity not found: %w", err)
	}
	if _, err := sess.Entities().GetByID(ctx, rightEntityID); err != nil {
		return nil, fmt.Errorf("right entity not found: %w", err)
	}
	rel := &models.EntityRelationship{
		TenantID:         tenantID,
		Name:             name,
		RelationshipType: "nn",
		LeftEntityID:     leftEntityID,
		RightEntityID:    rightEntityID,
	}
	if err := sess.EntityRelationships().Create(ctx, rel); err != nil {
		return nil, fmt.Errorf("create relationship: %w", err)
	}
	return rel, nil
}

func (s *EntityService) ListRelationshipsForEntity(ctx context.Context, tenantID, entityID uuid.UUID) ([]models.EntityRelationship, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	items, err := sess.EntityRelationships().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return nil, err
	}
	var filtered []models.EntityRelationship
	for _, item := range items {
		if item.LeftEntityID == entityID || item.RightEntityID == entityID {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

func (s *EntityService) DeleteRelationship(ctx context.Context, tenantID, id uuid.UUID) error {
	sess := s.store.WithTenant(ctx, tenantID)
	if _, err := sess.EntityRelationships().GetByID(ctx, id); err != nil {
		return err
	}
	return sess.EntityRelationships().Delete(ctx, id)
}

func (s *EntityService) GetRelationship(ctx context.Context, tenantID, id uuid.UUID) (*models.EntityRelationship, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	return sess.EntityRelationships().GetByID(ctx, id)
}

// ListLookupDependents returns fields in other entities that look up to this entity.
func (s *EntityService) ListLookupDependents(ctx context.Context, tenantID, entityID uuid.UUID) ([]models.EntityField, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	all, err := sess.EntityFields().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return nil, err
	}
	var deps []models.EntityField
	for _, f := range all {
		if f.RelatedEntityID != nil && *f.RelatedEntityID == entityID {
			deps = append(deps, f)
		}
	}
	return deps, nil
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
