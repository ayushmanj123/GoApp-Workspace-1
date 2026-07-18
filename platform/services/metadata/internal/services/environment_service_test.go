package services

import (
	"context"
	"testing"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/services/fakes"
	"github.com/google/uuid"
)

func TestEnvironmentCreateListGet(t *testing.T) {
	store := fakes.NewFakeStore()
	tenantID := uuid.New()
	appID := uuid.New()
	store.Apps().Create(context.Background(), &models.Application{ID: appID, TenantID: tenantID, Name: "App", Status: "draft"})

	svc := NewEnvironmentService(store)
	created, err := svc.Create(context.Background(), tenantID, appID, "Production", "production")
	if err != nil {
		t.Fatalf("create environment failed: %v", err)
	}
	if created.EnvironmentType != "production" {
		t.Fatalf("expected environment_type production, got %s", created.EnvironmentType)
	}

	items, err := svc.List(context.Background(), tenantID, appID)
	if err != nil {
		t.Fatalf("list environments failed: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 environment, got %d", len(items))
	}

	got, err := svc.Get(context.Background(), tenantID, appID, created.ID)
	if err != nil {
		t.Fatalf("get environment failed: %v", err)
	}
	if got.Name != "Production" {
		t.Fatalf("expected name Production, got %s", got.Name)
	}
}

func TestEnvironmentPromoteRequiresReleasedVersion(t *testing.T) {
	store := fakes.NewFakeStore()
	tenantID := uuid.New()
	appID := uuid.New()
	store.Apps().Create(context.Background(), &models.Application{ID: appID, TenantID: tenantID, Name: "App", Status: "draft"})

	draftVersion := &models.ApplicationVersion{ID: uuid.New(), TenantID: tenantID, ApplicationID: appID, Version: "0.1.0", Status: "draft"}
	store.VersionsRepo().Create(context.Background(), draftVersion)
	releasedVersion := &models.ApplicationVersion{ID: uuid.New(), TenantID: tenantID, ApplicationID: appID, Version: "0.1.1", Status: "released"}
	store.VersionsRepo().Create(context.Background(), releasedVersion)

	svc := NewEnvironmentService(store)
	env, err := svc.Create(context.Background(), tenantID, appID, "Staging", "test")
	if err != nil {
		t.Fatalf("create environment failed: %v", err)
	}

	if _, err := svc.Promote(context.Background(), tenantID, appID, env.ID, draftVersion.ID); err != ErrVersionNotReleased {
		t.Fatalf("expected ErrVersionNotReleased, got %v", err)
	}

	promoted, err := svc.Promote(context.Background(), tenantID, appID, env.ID, releasedVersion.ID)
	if err != nil {
		t.Fatalf("promote failed: %v", err)
	}
	if promoted.CurrentVersionID == nil || *promoted.CurrentVersionID != releasedVersion.ID {
		t.Fatalf("expected environment current_version_id to point at the released version")
	}
	if promoted.CurrentVersion == nil || *promoted.CurrentVersion != "0.1.1" {
		t.Fatalf("expected current_version label 0.1.1")
	}
}

func TestEnvironmentGetScopedToOwningApplication(t *testing.T) {
	store := fakes.NewFakeStore()
	tenantID := uuid.New()
	appID := uuid.New()
	otherAppID := uuid.New()
	store.Apps().Create(context.Background(), &models.Application{ID: appID, TenantID: tenantID, Name: "App", Status: "draft"})
	store.Apps().Create(context.Background(), &models.Application{ID: otherAppID, TenantID: tenantID, Name: "Other", Status: "draft"})

	svc := NewEnvironmentService(store)
	env, err := svc.Create(context.Background(), tenantID, appID, "Dev", "development")
	if err != nil {
		t.Fatalf("create environment failed: %v", err)
	}

	if _, err := svc.Get(context.Background(), tenantID, otherAppID, env.ID); err != ErrEnvironmentNotFound {
		t.Fatalf("expected ErrEnvironmentNotFound when fetching via the wrong application, got %v", err)
	}
}
