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
	onSelectProp := &models.ControlProperty{
		ID: uuid.New(), TenantID: tenantID, ControlID: childHigh.ID, PropertyName: "onSelect",
		PropertyValue: datatypes.JSON([]byte(`{"formula":"Navigate(Screen1)"}`)),
	}
	store.ControlPropsRepo().Create(context.Background(), onSelectProp)
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
	high := container.Children[1]
	if len(high.Formulas) != 1 {
		t.Fatalf("expected onSelect promoted into Formulas, got %d", len(high.Formulas))
	}
	if high.Formulas[0].PropertyName != "onSelect" || high.Formulas[0].FormulaText != "Navigate(Screen1)" {
		t.Fatalf("unexpected promoted formula: %#v", high.Formulas[0])
	}
}

func TestBuildRuntimePackageByEnvironment(t *testing.T) {
	store := fakes.NewFakeStore()
	tenantID := uuid.New()
	appID := uuid.New()
	screenID := uuid.New()

	store.Apps().Create(context.Background(), &models.Application{ID: appID, TenantID: tenantID, Name: "App", Status: "draft"})
	store.ScreensRepo().Create(context.Background(), &models.Screen{ID: screenID, TenantID: tenantID, ApplicationID: appID, Name: "Home", DisplayOrder: 0, LayoutType: "responsive"})
	store.ControlsRepo().Create(context.Background(), &models.Control{ID: uuid.New(), TenantID: tenantID, ScreenID: screenID, Name: "Label1", ControlType: "label", Width: 10, Height: 10})

	publishSvc := NewPublishService(store)
	result, err := publishSvc.Publish(context.Background(), tenantID, appID, PublishOptions{})
	if err != nil {
		t.Fatalf("publish: %v", err)
	}

	envSvc := NewEnvironmentService(store)
	env, err := envSvc.Create(context.Background(), tenantID, appID, "Staging", "test")
	if err != nil {
		t.Fatalf("create env: %v", err)
	}
	if _, err := envSvc.Promote(context.Background(), tenantID, appID, env.ID, result.VersionID); err != nil {
		t.Fatalf("promote: %v", err)
	}

	runtimeSvc := NewRuntimeService(store)
	envID := env.ID
	pkg, err := runtimeSvc.BuildRuntimePackageWithOptions(context.Background(), tenantID, appID, RuntimePackageOptions{
		EnvironmentID: &envID,
	})
	if err != nil {
		t.Fatalf("build env package: %v", err)
	}
	if pkg.ID != appID {
		t.Fatalf("expected app id %s, got %s", appID, pkg.ID)
	}
	if len(pkg.Screens) != 1 || pkg.Screens[0].Name != "Home" {
		t.Fatalf("unexpected package screens: %#v", pkg.Screens)
	}

	if _, err := runtimeSvc.BuildRuntimePackageWithOptions(context.Background(), tenantID, appID, RuntimePackageOptions{
		EnvironmentID: &[]uuid.UUID{uuid.New()}[0],
	}); err == nil {
		t.Fatalf("expected error for unknown environment")
	}

	emptyEnv, err := envSvc.Create(context.Background(), tenantID, appID, "Empty", "development")
	if err != nil {
		t.Fatalf("create empty env: %v", err)
	}
	emptyID := emptyEnv.ID
	if _, err := runtimeSvc.BuildRuntimePackageWithOptions(context.Background(), tenantID, appID, RuntimePackageOptions{
		EnvironmentID: &emptyID,
	}); err != ErrEnvironmentNotPromoted {
		t.Fatalf("expected ErrEnvironmentNotPromoted, got %v", err)
	}
}
