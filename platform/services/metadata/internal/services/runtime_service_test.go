package services

import (
	"context"
	"testing"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/services/fakes"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

func TestBuildRuntimePackage(t *testing.T) {
	store := fakes.NewFakeStore()
	tenantID := uuid.New()
	appID := uuid.New()
	otherAppID := uuid.New()

	// populate fake repos
	app := &models.Application{ID: appID, TenantID: tenantID, Name: "App1", Status: "draft"}
	store.Apps().Create(context.Background(), app)
	otherApp := &models.Application{ID: otherAppID, TenantID: tenantID, Name: "App2", Status: "draft"}
	store.Apps().Create(context.Background(), otherApp)

	s1 := &models.Screen{ID: uuid.New(), TenantID: tenantID, ApplicationID: appID, Name: "Screen1", DisplayOrder: 1, LayoutType: "grid"}
	store.ScreensRepo().Create(context.Background(), s1)
	otherScreen := &models.Screen{ID: uuid.New(), TenantID: tenantID, ApplicationID: otherAppID, Name: "Screen2", DisplayOrder: 1, LayoutType: "grid"}
	store.ScreensRepo().Create(context.Background(), otherScreen)

	parent := &models.Control{ID: uuid.New(), TenantID: tenantID, ScreenID: s1.ID, Name: "Container", ControlType: "container", X: 0, Y: 0, Width: 10, Height: 10, ZIndex: 5}
	store.ControlsRepo().Create(context.Background(), parent)
	root := &models.Control{ID: uuid.New(), TenantID: tenantID, ScreenID: s1.ID, Name: "RootLabel", ControlType: "label", X: 0, Y: 0, Width: 10, Height: 10, ZIndex: 1}
	store.ControlsRepo().Create(context.Background(), root)
	childHigh := &models.Control{ID: uuid.New(), TenantID: tenantID, ScreenID: s1.ID, ParentControlID: &parent.ID, Name: "ChildHigh", ControlType: "button", X: 0, Y: 0, Width: 10, Height: 10, ZIndex: 9}
	store.ControlsRepo().Create(context.Background(), childHigh)
	childLow := &models.Control{ID: uuid.New(), TenantID: tenantID, ScreenID: s1.ID, ParentControlID: &parent.ID, Name: "ChildLow", ControlType: "button", X: 0, Y: 0, Width: 10, Height: 10, ZIndex: 2}
	store.ControlsRepo().Create(context.Background(), childLow)
	otherControl := &models.Control{ID: uuid.New(), TenantID: tenantID, ScreenID: otherScreen.ID, Name: "Ctl2", ControlType: "button", X: 0, Y: 0, Width: 10, Height: 10, ZIndex: 1}
	store.ControlsRepo().Create(context.Background(), otherControl)

	cp := &models.ControlProperty{ID: uuid.New(), TenantID: tenantID, ControlID: childLow.ID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`"Hello"`))}
	store.ControlPropsRepo().Create(context.Background(), cp)
	otherProp := &models.ControlProperty{ID: uuid.New(), TenantID: tenantID, ControlID: otherControl.ID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`"Ignore"`))}
	store.ControlPropsRepo().Create(context.Background(), otherProp)

	f1 := &models.Formula{ID: uuid.New(), TenantID: tenantID, ControlID: childLow.ID, PropertyName: "text", FormulaText: "'hi'", FormulaType: "static"}
	store.FormulasRepo().Create(context.Background(), f1)
	otherFormula := &models.Formula{ID: uuid.New(), TenantID: tenantID, ControlID: otherControl.ID, PropertyName: "text", FormulaText: "'ignore'", FormulaType: "static"}
	store.FormulasRepo().Create(context.Background(), otherFormula)

	svc := NewRuntimeService(store)
	pkg, err := svc.BuildRuntimePackage(context.Background(), tenantID, appID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if pkg.ID != appID {
		t.Fatalf("expected package app id match")
	}
	if len(pkg.Screens) != 1 {
		t.Fatalf("expected 1 screen")
	}
	if len(pkg.Screens[0].Controls) != 2 {
		t.Fatalf("expected 2 root controls")
	}
	if pkg.Screens[0].Controls[0].Name != "RootLabel" {
		t.Fatalf("expected root controls sorted by z-index")
	}
	container := pkg.Screens[0].Controls[1]
	if len(container.Children) != 2 {
		t.Fatalf("expected 2 child controls")
	}
	if container.Children[0].Name != "ChildLow" || container.Children[1].Name != "ChildHigh" {
		t.Fatalf("expected child controls sorted by z-index")
	}
	if len(container.Children[0].Formulas) != 1 {
		t.Fatalf("expected 1 formula")
	}
}
