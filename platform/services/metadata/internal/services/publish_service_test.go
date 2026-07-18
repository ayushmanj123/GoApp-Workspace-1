package services

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/goapps-platform/metadata-service/internal/api/contracts"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/services/fakes"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

func TestPublishCreatesImmutableSnapshot(t *testing.T) {
	store := fakes.NewFakeStore()
	tenantID := uuid.New()
	appID := uuid.New()
	screenID := uuid.New()
	labelID := uuid.New()
	propID := uuid.New()

	app := &models.Application{ID: appID, TenantID: tenantID, Name: "App", Status: "draft"}
	store.Apps().Create(context.Background(), app)
	screen := &models.Screen{ID: screenID, TenantID: tenantID, ApplicationID: appID, Name: "Home", DisplayOrder: 0, LayoutType: "responsive"}
	store.ScreensRepo().Create(context.Background(), screen)
	label := &models.Control{ID: labelID, TenantID: tenantID, ScreenID: screenID, Name: "Label1", ControlType: "label", Width: 10, Height: 10}
	store.ControlsRepo().Create(context.Background(), label)
	store.ControlPropsRepo().Create(context.Background(), &models.ControlProperty{
		ID: propID, TenantID: tenantID, ControlID: labelID, PropertyName: "text",
		PropertyValue: datatypes.JSON([]byte(`{"value":"Before"}`)),
	})

	publishSvc := NewPublishService(store)
	result, err := publishSvc.Publish(context.Background(), tenantID, appID, PublishOptions{})
	if err != nil {
		t.Fatalf("publish failed: %v", err)
	}
	if result.Version != "0.1.0" {
		t.Fatalf("expected initial version 0.1.0, got %s", result.Version)
	}

	updated, _ := store.Apps().GetByID(context.Background(), appID)
	if updated.CurrentVersionID == nil || *updated.CurrentVersionID != result.VersionID {
		t.Fatalf("expected current_version_id to be set")
	}
	if updated.Status != "published" {
		t.Fatalf("expected published status")
	}

	store.ControlPropsRepo().Update(context.Background(), &models.ControlProperty{
		ID: propID, TenantID: tenantID, ControlID: labelID, PropertyName: "text",
		PropertyValue: datatypes.JSON([]byte(`{"value":"After"}`)),
	})

	runtimeSvc := NewRuntimeService(store)
	publishedPkg, err := runtimeSvc.BuildRuntimePackageWithOptions(context.Background(), tenantID, appID, RuntimePackageOptions{Channel: "published"})
	if err != nil {
		t.Fatalf("load published package: %v", err)
	}
	draftPkg, err := runtimeSvc.BuildRuntimePackageWithOptions(context.Background(), tenantID, appID, RuntimePackageOptions{Channel: "draft"})
	if err != nil {
		t.Fatalf("load draft package: %v", err)
	}

	publishedText := controlPropertyValue(publishedPkg.Screens[0].Controls, "Label1", "text")
	draftText := controlPropertyValue(draftPkg.Screens[0].Controls, "Label1", "text")
	if publishedText == draftText {
		t.Fatalf("expected published snapshot to differ from draft after edit")
	}

	snapshots, err := listSnapshotsByVersion(context.Background(), store.WithTenant(context.Background(), tenantID), result.VersionID)
	if err != nil || len(snapshots) != 1 {
		t.Fatalf("expected one snapshot")
	}
	var frozen map[string]any
	if err := json.Unmarshal(snapshots[0].SnapshotJSON, &frozen); err != nil {
		t.Fatalf("snapshot json invalid: %v", err)
	}
}

func TestPublishBumpsVersionOnRepublish(t *testing.T) {
	store := fakes.NewFakeStore()
	tenantID := uuid.New()
	appID := uuid.New()
	screenID := uuid.New()

	store.Apps().Create(context.Background(), &models.Application{ID: appID, TenantID: tenantID, Name: "App", Status: "draft"})
	store.ScreensRepo().Create(context.Background(), &models.Screen{ID: screenID, TenantID: tenantID, ApplicationID: appID, Name: "Home", DisplayOrder: 0, LayoutType: "responsive"})
	store.ControlsRepo().Create(context.Background(), &models.Control{ID: uuid.New(), TenantID: tenantID, ScreenID: screenID, Name: "Label1", ControlType: "label", Width: 10, Height: 10})

	svc := NewPublishService(store)
	first, err := svc.Publish(context.Background(), tenantID, appID, PublishOptions{})
	if err != nil {
		t.Fatalf("first publish failed: %v", err)
	}
	second, err := svc.Publish(context.Background(), tenantID, appID, PublishOptions{})
	if err != nil {
		t.Fatalf("second publish failed: %v", err)
	}
	if second.Version != "0.1.1" {
		t.Fatalf("expected 0.1.1, got %s", second.Version)
	}
	if first.VersionID == second.VersionID {
		t.Fatalf("expected distinct version ids")
	}
}

func TestUnpublishClearsCurrentVersionButKeepsVersions(t *testing.T) {
	store := fakes.NewFakeStore()
	tenantID := uuid.New()
	appID := uuid.New()
	screenID := uuid.New()

	store.Apps().Create(context.Background(), &models.Application{ID: appID, TenantID: tenantID, Name: "App", Status: "draft"})
	store.ScreensRepo().Create(context.Background(), &models.Screen{ID: screenID, TenantID: tenantID, ApplicationID: appID, Name: "Home", DisplayOrder: 0, LayoutType: "responsive"})
	store.ControlsRepo().Create(context.Background(), &models.Control{ID: uuid.New(), TenantID: tenantID, ScreenID: screenID, Name: "Label1", ControlType: "label", Width: 10, Height: 10})

	svc := NewPublishService(store)
	published, err := svc.Publish(context.Background(), tenantID, appID, PublishOptions{})
	if err != nil {
		t.Fatalf("publish failed: %v", err)
	}

	result, err := svc.Unpublish(context.Background(), tenantID, appID)
	if err != nil {
		t.Fatalf("unpublish failed: %v", err)
	}
	if result.Status != "draft" {
		t.Fatalf("expected draft status, got %s", result.Status)
	}

	app, _ := store.Apps().GetByID(context.Background(), appID)
	if app.CurrentVersionID != nil {
		t.Fatalf("expected current_version_id cleared")
	}
	if app.Status != "draft" {
		t.Fatalf("expected application status draft, got %s", app.Status)
	}

	versions, _, err := svc.ListVersions(context.Background(), tenantID, appID, 0, 0)
	if err != nil {
		t.Fatalf("list versions failed: %v", err)
	}
	if len(versions) != 1 || versions[0].ID != published.VersionID {
		t.Fatalf("expected the published version to still exist after unpublish")
	}
}

func TestRollbackRestoresPreviousReleasedVersion(t *testing.T) {
	store := fakes.NewFakeStore()
	tenantID := uuid.New()
	appID := uuid.New()
	screenID := uuid.New()

	store.Apps().Create(context.Background(), &models.Application{ID: appID, TenantID: tenantID, Name: "App", Status: "draft"})
	store.ScreensRepo().Create(context.Background(), &models.Screen{ID: screenID, TenantID: tenantID, ApplicationID: appID, Name: "Home", DisplayOrder: 0, LayoutType: "responsive"})
	store.ControlsRepo().Create(context.Background(), &models.Control{ID: uuid.New(), TenantID: tenantID, ScreenID: screenID, Name: "Label1", ControlType: "label", Width: 10, Height: 10})

	svc := NewPublishService(store)
	first, err := svc.Publish(context.Background(), tenantID, appID, PublishOptions{})
	if err != nil {
		t.Fatalf("first publish failed: %v", err)
	}
	second, err := svc.Publish(context.Background(), tenantID, appID, PublishOptions{})
	if err != nil {
		t.Fatalf("second publish failed: %v", err)
	}

	app, _ := store.Apps().GetByID(context.Background(), appID)
	if app.CurrentVersionID == nil || *app.CurrentVersionID != second.VersionID {
		t.Fatalf("expected current version to be the second publish before rollback")
	}

	result, err := svc.Rollback(context.Background(), tenantID, appID, first.VersionID)
	if err != nil {
		t.Fatalf("rollback failed: %v", err)
	}
	if result.VersionID != first.VersionID {
		t.Fatalf("expected rollback to point at first version")
	}
	if result.Status != "published" {
		t.Fatalf("expected published status after rollback, got %s", result.Status)
	}

	app, _ = store.Apps().GetByID(context.Background(), appID)
	if app.CurrentVersionID == nil || *app.CurrentVersionID != first.VersionID {
		t.Fatalf("expected current_version_id to point at first version after rollback")
	}
}

func TestRollbackRejectsVersionFromAnotherApplication(t *testing.T) {
	store := fakes.NewFakeStore()
	tenantID := uuid.New()
	appID := uuid.New()
	otherAppID := uuid.New()
	screenID := uuid.New()

	store.Apps().Create(context.Background(), &models.Application{ID: appID, TenantID: tenantID, Name: "App", Status: "draft"})
	store.Apps().Create(context.Background(), &models.Application{ID: otherAppID, TenantID: tenantID, Name: "Other", Status: "draft"})
	store.ScreensRepo().Create(context.Background(), &models.Screen{ID: screenID, TenantID: tenantID, ApplicationID: appID, Name: "Home", DisplayOrder: 0, LayoutType: "responsive"})
	store.ControlsRepo().Create(context.Background(), &models.Control{ID: uuid.New(), TenantID: tenantID, ScreenID: screenID, Name: "Label1", ControlType: "label", Width: 10, Height: 10})

	svc := NewPublishService(store)
	otherVersion := &models.ApplicationVersion{ID: uuid.New(), TenantID: tenantID, ApplicationID: otherAppID, Version: "0.1.0", Status: "released"}
	store.VersionsRepo().Create(context.Background(), otherVersion)

	if _, err := svc.Rollback(context.Background(), tenantID, appID, otherVersion.ID); err == nil {
		t.Fatalf("expected rollback to reject a version belonging to a different application")
	}
}

func TestDeprecateClearsCurrentPointerWhenActive(t *testing.T) {
	store := fakes.NewFakeStore()
	tenantID := uuid.New()
	appID := uuid.New()
	screenID := uuid.New()

	store.Apps().Create(context.Background(), &models.Application{ID: appID, TenantID: tenantID, Name: "App", Status: "draft"})
	store.ScreensRepo().Create(context.Background(), &models.Screen{ID: screenID, TenantID: tenantID, ApplicationID: appID, Name: "Home", DisplayOrder: 0, LayoutType: "responsive"})
	store.ControlsRepo().Create(context.Background(), &models.Control{ID: uuid.New(), TenantID: tenantID, ScreenID: screenID, Name: "Label1", ControlType: "label", Width: 10, Height: 10})

	svc := NewPublishService(store)
	published, err := svc.Publish(context.Background(), tenantID, appID, PublishOptions{})
	if err != nil {
		t.Fatalf("publish failed: %v", err)
	}

	result, err := svc.Deprecate(context.Background(), tenantID, appID, published.VersionID)
	if err != nil {
		t.Fatalf("deprecate failed: %v", err)
	}
	if !result.WasCurrent {
		t.Fatalf("expected WasCurrent to be true")
	}
	if result.ApplicationStatus != "draft" {
		t.Fatalf("expected application status draft after deprecating the current version, got %s", result.ApplicationStatus)
	}

	version, _ := store.VersionsRepo().GetByID(context.Background(), published.VersionID)
	if version.Status != "deprecated" {
		t.Fatalf("expected version status deprecated, got %s", version.Status)
	}

	app, _ := store.Apps().GetByID(context.Background(), appID)
	if app.CurrentVersionID != nil {
		t.Fatalf("expected current_version_id cleared after deprecating the active version")
	}
}

func controlPropertyValue(controls []contracts.RuntimeControl, name, prop string) string {
	for _, control := range controls {
		if control.Name == name {
			if v, ok := control.Properties[prop]; ok {
				if m, ok := v.(map[string]any); ok {
					if inner, ok := m["value"]; ok {
						return stringifyPropertyValue(inner)
					}
					return stringifyPropertyValue(v)
				}
				return stringifyPropertyValue(v)
			}
		}
		if child := controlPropertyValue(control.Children, name, prop); child != "" {
			return child
		}
	}
	return ""
}

func stringifyPropertyValue(v any) string {
	switch typed := v.(type) {
	case string:
		return typed
	default:
		b, _ := json.Marshal(typed)
		return string(b)
	}
}
