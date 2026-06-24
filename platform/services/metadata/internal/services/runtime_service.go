package services

import (
	"context"
	"fmt"

	"github.com/goapps-platform/metadata-service/internal/api/contracts"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/google/uuid"
)

// RuntimeService provides read-only runtime packages built from metadata.
type RuntimeService struct{ store repositories.Store }

type byFieldRepo[T any] interface {
	ListByField(ctx context.Context, field string, value any, limit int, offset int) ([]T, error)
}

type byFieldInRepo[T any] interface {
	ListByFieldIn(ctx context.Context, field string, values any, limit int, offset int) ([]T, error)
}

func NewRuntimeService(store repositories.Store) *RuntimeService {
	return &RuntimeService{store: store}
}

func (s *RuntimeService) GetApplicationPackage(ctx context.Context, tenantID, appID uuid.UUID) (*models.Application, []models.Screen, []models.Control, []models.ControlProperty, []models.Formula, []models.ComponentDefinition, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	app, err := sess.Applications().GetByID(ctx, appID)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, fmt.Errorf("load application: %w", err)
	}

	screens, err := s.loadScreens(ctx, sess, tenantID, appID)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, err
	}

	componentDefs, err := s.loadComponentDefinitions(ctx, sess, tenantID, appID)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, err
	}

	screenIDs := collectScreenIDs(screens)
	if len(screenIDs) == 0 {
		return app, screens, nil, nil, nil, componentDefs, nil
	}

	controls, err := s.loadControls(ctx, sess, tenantID, screenIDs)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, err
	}

	controlIDs := collectControlIDs(controls)
	if len(controlIDs) == 0 {
		return app, screens, controls, nil, nil, componentDefs, nil
	}

	props, err := s.loadProperties(ctx, sess, tenantID, controlIDs)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, err
	}
	formulas, err := s.loadFormulas(ctx, sess, tenantID, controlIDs)
	if err != nil {
		return nil, nil, nil, nil, nil, nil, err
	}

	return app, screens, controls, props, formulas, componentDefs, nil
}

// Convenience for assembler
func (s *RuntimeService) BuildRuntimePackage(ctx context.Context, tenantID, appID uuid.UUID) (*contracts.RuntimeApplication, error) {
	app, screens, controls, props, formulas, componentDefs, err := s.GetApplicationPackage(ctx, tenantID, appID)
	if err != nil {
		return nil, err
	}
	entitySvc := NewEntityService(s.store)
	entities, entityFields, err := entitySvc.LoadEntitiesWithFields(ctx, tenantID, appID)
	if err != nil {
		return nil, err
	}
	pkg, err := assembleRuntimeApplication(app, screens, controls, props, formulas, componentDefs, entities, entityFields)
	if err != nil {
		return nil, err
	}
	return pkg, nil
}

// FindScreenOwner returns the application id that owns the screen.
func (s *RuntimeService) FindScreenOwner(ctx context.Context, tenantID, screenID uuid.UUID) (uuid.UUID, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	scr, err := sess.Screens().GetByID(ctx, screenID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("find screen owner: %w", err)
	}
	return scr.ApplicationID, nil
}

func (s *RuntimeService) loadScreens(ctx context.Context, sess repositories.TenantSession, tenantID, appID uuid.UUID) ([]models.Screen, error) {
	if repo, ok := any(sess.Screens()).(byFieldRepo[models.Screen]); ok {
		items, err := repo.ListByField(ctx, "application_id", appID, 0, 0)
		if err != nil {
			return nil, fmt.Errorf("load screens: %w", err)
		}
		return items, nil
	}
	items, err := sess.Screens().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("load screens: %w", err)
	}
	var filtered []models.Screen
	for _, it := range items {
		if it.ApplicationID == appID {
			filtered = append(filtered, it)
		}
	}
	return filtered, nil
}

func (s *RuntimeService) loadControls(ctx context.Context, sess repositories.TenantSession, tenantID uuid.UUID, screenIDs []uuid.UUID) ([]models.Control, error) {
	if repo, ok := any(sess.Controls()).(byFieldInRepo[models.Control]); ok {
		items, err := repo.ListByFieldIn(ctx, "screen_id", screenIDs, 0, 0)
		if err != nil {
			return nil, fmt.Errorf("load controls: %w", err)
		}
		return items, nil
	}
	items, err := sess.Controls().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("load controls: %w", err)
	}
	screenSet := map[uuid.UUID]struct{}{}
	for _, id := range screenIDs {
		screenSet[id] = struct{}{}
	}
	var filtered []models.Control
	for _, it := range items {
		if _, ok := screenSet[it.ScreenID]; ok {
			filtered = append(filtered, it)
		}
	}
	return filtered, nil
}

func (s *RuntimeService) loadProperties(ctx context.Context, sess repositories.TenantSession, tenantID uuid.UUID, controlIDs []uuid.UUID) ([]models.ControlProperty, error) {
	if repo, ok := any(sess.ControlProperties()).(byFieldInRepo[models.ControlProperty]); ok {
		items, err := repo.ListByFieldIn(ctx, "control_id", controlIDs, 0, 0)
		if err != nil {
			return nil, fmt.Errorf("load control properties: %w", err)
		}
		return items, nil
	}
	items, err := sess.ControlProperties().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("load control properties: %w", err)
	}
	controlSet := map[uuid.UUID]struct{}{}
	for _, id := range controlIDs {
		controlSet[id] = struct{}{}
	}
	var filtered []models.ControlProperty
	for _, it := range items {
		if _, ok := controlSet[it.ControlID]; ok {
			filtered = append(filtered, it)
		}
	}
	return filtered, nil
}

func (s *RuntimeService) loadFormulas(ctx context.Context, sess repositories.TenantSession, tenantID uuid.UUID, controlIDs []uuid.UUID) ([]models.Formula, error) {
	if repo, ok := any(sess.Formulas()).(byFieldInRepo[models.Formula]); ok {
		items, err := repo.ListByFieldIn(ctx, "control_id", controlIDs, 0, 0)
		if err != nil {
			return nil, fmt.Errorf("load formulas: %w", err)
		}
		return items, nil
	}
	items, err := sess.Formulas().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("load formulas: %w", err)
	}
	controlSet := map[uuid.UUID]struct{}{}
	for _, id := range controlIDs {
		controlSet[id] = struct{}{}
	}
	var filtered []models.Formula
	for _, it := range items {
		if _, ok := controlSet[it.ControlID]; ok {
			filtered = append(filtered, it)
		}
	}
	return filtered, nil
}

func collectScreenIDs(items []models.Screen) []uuid.UUID {
	ids := make([]uuid.UUID, 0, len(items))
	for _, it := range items {
		ids = append(ids, it.ID)
	}
	return ids
}

func collectControlIDs(items []models.Control) []uuid.UUID {
	ids := make([]uuid.UUID, 0, len(items))
	for _, it := range items {
		ids = append(ids, it.ID)
	}
	return ids
}

func (s *RuntimeService) loadComponentDefinitions(ctx context.Context, sess repositories.TenantSession, tenantID, appID uuid.UUID) ([]models.ComponentDefinition, error) {
	if repo, ok := any(sess.ComponentDefinitions()).(byFieldRepo[models.ComponentDefinition]); ok {
		items, err := repo.ListByField(ctx, "application_id", appID, 0, 0)
		if err != nil {
			return nil, fmt.Errorf("load component definitions: %w", err)
		}
		return items, nil
	}
	items, err := sess.ComponentDefinitions().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("load component definitions: %w", err)
	}
	var filtered []models.ComponentDefinition
	for _, it := range items {
		if it.ApplicationID == appID {
			filtered = append(filtered, it)
		}
	}
	return filtered, nil
}
