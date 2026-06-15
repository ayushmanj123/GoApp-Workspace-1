package services

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/goapps-platform/metadata-service/internal/api"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
)

// RuntimeService provides read-only runtime packages built from metadata.
type RuntimeService struct{ store repositories.Store }

func NewRuntimeService(store repositories.Store) *RuntimeService { return &RuntimeService{store: store} }

func (s *RuntimeService) GetApplicationPackage(ctx context.Context, tenantID, appID uuid.UUID) (*models.Application, []models.Screen, []models.Control, []models.ControlProperty, []models.Formula, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	app, err := sess.Applications().GetByID(ctx, appID)
	if err != nil { return nil, nil, nil, nil, nil, fmt.Errorf("load application: %w", err) }

	// bulk load screens, controls, properties, formulas
	screens, err := sess.Screens().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil { return nil, nil, nil, nil, nil, fmt.Errorf("load screens: %w", err) }

	controls, err := sess.Controls().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil { return nil, nil, nil, nil, nil, fmt.Errorf("load controls: %w", err) }

	props, err := sess.ControlProperties().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil { return nil, nil, nil, nil, nil, fmt.Errorf("load control properties: %w", err) }

	formulas, err := sess.Formulas().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil { return nil, nil, nil, nil, nil, fmt.Errorf("load formulas: %w", err) }

	return app, screens, controls, props, formulas, nil
}

// Convenience for assembler
func (s *RuntimeService) BuildRuntimePackage(ctx context.Context, tenantID, appID uuid.UUID) (*api.RuntimeApplication, error) {
	app, screens, controls, props, formulas, err := s.GetApplicationPackage(ctx, tenantID, appID)
	if err != nil { return nil, err }
	// filter screens for this application
	var appScreens []models.Screen
	for _, sc := range screens { if sc.ApplicationID == appID { appScreens = append(appScreens, sc) } }
	// filter controls for these screens
	var appControls []models.Control
	screenIDs := map[string]struct{}{}
	for _, sc := range appScreens { screenIDs[sc.ID.String()] = struct{}{} }
	for _, c := range controls { if _, ok := screenIDs[c.ScreenID.String()]; ok { appControls = append(appControls, c) } }
	// filter props & formulas for these controls
	controlIDs := map[string]struct{}{}
	for _, c := range appControls { controlIDs[c.ID.String()] = struct{}{} }
	var appProps []models.ControlProperty
	for _, p := range props { if _, ok := controlIDs[p.ControlID.String()]; ok { appProps = append(appProps, p) } }
	var appFormulas []models.Formula
	for _, f := range formulas { if _, ok := controlIDs[f.ControlID.String()]; ok { appFormulas = append(appFormulas, f) } }
	pkg := assembleRuntimeApplication(app, appScreens, appControls, appProps, appFormulas)
	return pkg, nil
}

// FindScreenOwner returns the application id that owns the screen.
func (s *RuntimeService) FindScreenOwner(ctx context.Context, tenantID, screenID uuid.UUID) (uuid.UUID, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	scr, err := sess.Screens().GetByID(ctx, screenID)
	if err != nil { return uuid.Nil, fmt.Errorf("find screen owner: %w", err) }
	return scr.ApplicationID, nil
}
