package services

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
)

// ApplicationService manages application lifecycle.
type ApplicationService struct {
	store repositories.Store
}

func NewApplicationService(store repositories.Store) *ApplicationService {
	return &ApplicationService{store: store}
}

func (s *ApplicationService) Create(ctx context.Context, tenantID uuid.UUID, name, description string) (*models.Application, error) {
	session := s.store.WithTenant(ctx, tenantID)
	app := &models.Application{
		Name:        name,
		Description: description,
		TenantID:    tenantID,
		Status:      "draft",
	}
	if err := session.Applications().Create(ctx, app); err != nil {
		return nil, fmt.Errorf("create application: %w", err)
	}
	return app, nil
}

func (s *ApplicationService) ListByTenant(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]models.Application, int64, error) {
	session := s.store.WithTenant(ctx, tenantID)
	apps, err := session.Applications().List(ctx, limit, offset)
	if err != nil { return nil, 0, fmt.Errorf("list applications: %w", err) }
	// total count not implemented in repo; return length
	return apps, int64(len(apps)), nil
}

func (s *ApplicationService) GetByID(ctx context.Context, tenantID uuid.UUID, id uuid.UUID) (*models.Application, error) {
	session := s.store.WithTenant(ctx, tenantID)
	app, err := session.Applications().GetByID(ctx, id)
	if err != nil { return nil, fmt.Errorf("get application: %w", err) }
	return app, nil
}

func (s *ApplicationService) Update(ctx context.Context, tenantID uuid.UUID, id uuid.UUID, updates map[string]interface{}) (*models.Application, error) {
	session := s.store.WithTenant(ctx, tenantID)
	app, err := session.Applications().GetByID(ctx, id)
	if err != nil { return nil, fmt.Errorf("get application for update: %w", err) }
	if v, ok := updates["name"].(string); ok { app.Name = v }
	if v, ok := updates["description"].(string); ok { app.Description = v }
	if v, ok := updates["status"].(string); ok { app.Status = v }
	if v, ok := updates["current_version_id"].(string); ok {
		if v == "" { app.CurrentVersionID = nil } else { if uid, err := uuid.Parse(v); err == nil { app.CurrentVersionID = &uid } }
	}
	if err := session.Applications().Update(ctx, app); err != nil { return nil, fmt.Errorf("update application: %w", err) }
	return app, nil
}

func (s *ApplicationService) Delete(ctx context.Context, tenantID uuid.UUID, id uuid.UUID) error {
	session := s.store.WithTenant(ctx, tenantID)
	return session.Applications().Delete(ctx, id)
}
