package services

import (
	"context"
	"fmt"
	"log/slog"
	"runtime/debug"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/shared/logging"
	"github.com/google/uuid"
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
		logServiceError(ctx, tenantID, err, "application_service.Create failed")
		return nil, fmt.Errorf("create application: %w", err)
	}
	// Seed a default screen so Studio opens with a usable canvas immediately.
	screen := &models.Screen{
		TenantID:      tenantID,
		ApplicationID: app.ID,
		Name:          "Screen1",
		DisplayOrder:  0,
		LayoutType:    "responsive",
	}
	if err := session.Screens().Create(ctx, screen); err != nil {
		logServiceError(ctx, tenantID, err, "application_service.Create seed screen failed")
		return nil, fmt.Errorf("create default screen: %w", err)
	}
	return app, nil
}

func (s *ApplicationService) ListByTenant(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]models.Application, int64, error) {
	session := s.store.WithTenant(ctx, tenantID)
	apps, err := session.Applications().List(ctx, limit, offset)
	if err != nil {
		logServiceError(ctx, tenantID, err, "application_service.ListByTenant failed")
		return nil, 0, fmt.Errorf("list applications: %w", err)
	}
	// total count not implemented in repo; return length
	return apps, int64(len(apps)), nil
}

func (s *ApplicationService) GetByID(ctx context.Context, tenantID uuid.UUID, id uuid.UUID) (*models.Application, error) {
	session := s.store.WithTenant(ctx, tenantID)
	app, err := session.Applications().GetByID(ctx, id)
	if err != nil {
		logServiceError(ctx, tenantID, err, "application_service.GetByID failed")
		return nil, fmt.Errorf("get application: %w", err)
	}
	return app, nil
}

func (s *ApplicationService) Update(ctx context.Context, tenantID uuid.UUID, id uuid.UUID, updates map[string]interface{}) (*models.Application, error) {
	session := s.store.WithTenant(ctx, tenantID)
	app, err := session.Applications().GetByID(ctx, id)
	if err != nil {
		logServiceError(ctx, tenantID, err, "application_service.Update failed: get application")
		return nil, fmt.Errorf("get application for update: %w", err)
	}
	if v, ok := updates["name"].(string); ok { app.Name = v }
	if v, ok := updates["description"].(string); ok { app.Description = v }
	if v, ok := updates["status"].(string); ok { app.Status = v }
	if v, ok := updates["on_start"].(string); ok {
		app.OnStart = &v
	}
	if v, ok := updates["current_version_id"].(string); ok {
		if v == "" { app.CurrentVersionID = nil } else { if uid, err := uuid.Parse(v); err == nil { app.CurrentVersionID = &uid } }
	}
	if err := session.Applications().Update(ctx, app); err != nil {
		logServiceError(ctx, tenantID, err, "application_service.Update failed")
		return nil, fmt.Errorf("update application: %w", err)
	}
	return app, nil
}

func (s *ApplicationService) Delete(ctx context.Context, tenantID uuid.UUID, id uuid.UUID) error {
	session := s.store.WithTenant(ctx, tenantID)
	err := session.Applications().Delete(ctx, id)
	if err != nil {
		logServiceError(ctx, tenantID, err, "application_service.Delete failed")
	}
	return err
}

func logServiceError(ctx context.Context, tenantID uuid.UUID, err error, msg string) {
	logger := logging.FromContext(ctx)
	logger.Error(msg,
		slog.String("tenant_id", tenantID.String()),
		slog.String("error", err.Error()),
		slog.String("stack", string(debug.Stack())),
	)
}
