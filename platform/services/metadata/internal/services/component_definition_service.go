package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type ComponentDefinitionService struct {
	store repositories.Store
}

func NewComponentDefinitionService(store repositories.Store) *ComponentDefinitionService {
	return &ComponentDefinitionService{store: store}
}

func (s *ComponentDefinitionService) Create(ctx context.Context, tenantID, appID uuid.UUID, name string, definition map[string]interface{}) (*models.ComponentDefinition, error) {
	raw, err := json.Marshal(definition)
	if err != nil {
		return nil, fmt.Errorf("marshal component definition: %w", err)
	}
	entity := &models.ComponentDefinition{
		TenantID:       tenantID,
		ApplicationID:  appID,
		Name:           name,
		DefinitionJSON: datatypes.JSON(raw),
	}
	sess := s.store.WithTenant(ctx, tenantID)
	if err := sess.ComponentDefinitions().Create(ctx, entity); err != nil {
		return nil, fmt.Errorf("create component definition: %w", err)
	}
	return entity, nil
}

func (s *ComponentDefinitionService) Get(ctx context.Context, tenantID, id uuid.UUID) (*models.ComponentDefinition, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	entity, err := sess.ComponentDefinitions().GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get component definition: %w", err)
	}
	return entity, nil
}

func (s *ComponentDefinitionService) Update(ctx context.Context, tenantID, id uuid.UUID, name string, definition map[string]interface{}) (*models.ComponentDefinition, error) {
	raw, err := json.Marshal(definition)
	if err != nil {
		return nil, fmt.Errorf("marshal component definition: %w", err)
	}
	sess := s.store.WithTenant(ctx, tenantID)
	entity, err := sess.ComponentDefinitions().GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get component definition: %w", err)
	}
	if strings.TrimSpace(name) != "" {
		entity.Name = strings.TrimSpace(name)
	}
	entity.DefinitionJSON = datatypes.JSON(raw)
	if err := sess.ComponentDefinitions().Update(ctx, entity); err != nil {
		return nil, fmt.Errorf("update component definition: %w", err)
	}
	return entity, nil
}

func (s *ComponentDefinitionService) ListByApplication(ctx context.Context, tenantID, appID uuid.UUID, limit, offset int) ([]models.ComponentDefinition, int64, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	if repo, ok := any(sess.ComponentDefinitions()).(interface {
		ListByField(ctx context.Context, field string, value any, limit int, offset int) ([]models.ComponentDefinition, error)
	}); ok {
		items, err := repo.ListByField(ctx, "application_id", appID, limit, offset)
		if err != nil {
			return nil, 0, fmt.Errorf("list component definitions: %w", err)
		}
		return items, int64(len(items)), nil
	}
	items, err := sess.ComponentDefinitions().ListByTenant(ctx, tenantID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list component definitions: %w", err)
	}
	var filtered []models.ComponentDefinition
	for _, item := range items {
		if item.ApplicationID == appID {
			filtered = append(filtered, item)
		}
	}
	return filtered, int64(len(filtered)), nil
}
