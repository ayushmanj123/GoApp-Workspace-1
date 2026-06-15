package services

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/services/fakes"
	"gorm.io/datatypes"
)

func TestBuildRuntimePackage(t *testing.T) {
		store := fakes.NewFakeStore()
		tenantID := uuid.New()
		appID := uuid.New()
		// populate fake repos
		app := &models.Application{ID: appID, TenantID: tenantID, Name: "App1", Status: "draft"}
		store.Apps().Create(context.Background(), app)
		s1 := &models.Screen{ID: uuid.New(), TenantID: tenantID, ApplicationID: appID, Name: "Screen1", DisplayOrder: 1, LayoutType: "grid"}
		store.ScreensRepo().Create(context.Background(), s1)
		c1 := &models.Control{ID: uuid.New(), TenantID: tenantID, ScreenID: s1.ID, Name: "Ctl1", ControlType: "button", X:0, Y:0, Width:10, Height:10, ZIndex:1}
		store.ControlsRepo().Create(context.Background(), c1)
		cp := &models.ControlProperty{ID: uuid.New(), TenantID: tenantID, ControlID: c1.ID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`"Hello"`))}
		store.ControlPropsRepo().Create(context.Background(), cp)
		f1 := &models.Formula{ID: uuid.New(), TenantID: tenantID, ControlID: c1.ID, PropertyName: "text", FormulaText: "'hi'", FormulaType: "static"}
		store.FormulasRepo().Create(context.Background(), f1)

	svc := NewRuntimeService(store)
	pkg, err := svc.BuildRuntimePackage(context.Background(), tenantID, appID)
	if err != nil { t.Fatalf("unexpected error: %v", err) }
	if pkg.ID != appID { t.Fatalf("expected package app id match") }
	if len(pkg.Screens) != 1 { t.Fatalf("expected 1 screen") }
	if len(pkg.Screens[0].Controls) != 1 { t.Fatalf("expected 1 control") }
}
