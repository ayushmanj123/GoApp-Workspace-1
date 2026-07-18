package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/goapps-platform/metadata-service/internal/api/contracts"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// PublishOptions configures an application publish operation.
type PublishOptions struct {
	Version *string
	Notes   *string
}

// PublishService creates immutable application version snapshots.
type PublishService struct {
	store   repositories.Store
	runtime *RuntimeService
}

func NewPublishService(store repositories.Store) *PublishService {
	return &PublishService{
		store:   store,
		runtime: NewRuntimeService(store),
	}
}

func (s *PublishService) Publish(ctx context.Context, tenantID, appID uuid.UUID, opts PublishOptions) (*contracts.PublishResult, error) {
	var result *contracts.PublishResult
	err := s.store.WithTenant(ctx, tenantID).Transaction(ctx, func(session repositories.TenantSession) error {
		app, err := session.Applications().GetByID(ctx, appID)
		if err != nil {
			return fmt.Errorf("publish: load application: %w", err)
		}
		if app.Status == "archived" {
			return fmt.Errorf("publish: application is archived")
		}

		pkg, err := s.runtime.buildDraftPackage(ctx, tenantID, appID)
		if err != nil {
			return fmt.Errorf("publish: build runtime package: %w", err)
		}
		if len(pkg.Screens) == 0 {
			return fmt.Errorf("publish: application has no screens")
		}

		versionLabel, err := s.resolveVersionLabel(ctx, session, appID, opts.Version)
		if err != nil {
			return err
		}

		manifest, err := buildPublishManifest(pkg, opts.Notes)
		if err != nil {
			return fmt.Errorf("publish: build manifest: %w", err)
		}

		snapshotJSON, err := json.Marshal(pkg)
		if err != nil {
			return fmt.Errorf("publish: marshal snapshot: %w", err)
		}

		version := &models.ApplicationVersion{
			TenantID:      tenantID,
			ApplicationID: appID,
			Version:       versionLabel,
			Status:        "released",
			Manifest:      datatypes.JSON(manifest),
		}
		if err := session.ApplicationVersions().Create(ctx, version); err != nil {
			return fmt.Errorf("publish: create version: %w", err)
		}

		snapshot := &models.ApplicationSnapshot{
			TenantID:             tenantID,
			ApplicationVersionID: version.ID,
			SnapshotJSON:         datatypes.JSON(snapshotJSON),
		}
		if err := session.ApplicationSnapshots().Create(ctx, snapshot); err != nil {
			return fmt.Errorf("publish: create snapshot: %w", err)
		}

		app.CurrentVersionID = &version.ID
		app.Status = "published"
		if err := session.Applications().Update(ctx, app); err != nil {
			return fmt.Errorf("publish: update application: %w", err)
		}

		result = &contracts.PublishResult{
			ApplicationID: appID,
			VersionID:     version.ID,
			Version:       versionLabel,
			Status:        version.Status,
			SnapshotID:    snapshot.ID,
			PublishedAt:   version.CreatedOn,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// Unpublish clears the application's current version pointer and reverts its
// status to draft. Existing versions and snapshots are left untouched so the
// application can be republished or rolled back later.
func (s *PublishService) Unpublish(ctx context.Context, tenantID, appID uuid.UUID) (*contracts.UnpublishResult, error) {
	var result *contracts.UnpublishResult
	err := s.store.WithTenant(ctx, tenantID).Transaction(ctx, func(session repositories.TenantSession) error {
		app, err := session.Applications().GetByID(ctx, appID)
		if err != nil {
			return fmt.Errorf("unpublish: load application: %w", err)
		}
		if app.Status == "archived" {
			return fmt.Errorf("unpublish: application is archived")
		}

		app.CurrentVersionID = nil
		app.Status = "draft"
		if err := session.Applications().Update(ctx, app); err != nil {
			return fmt.Errorf("unpublish: update application: %w", err)
		}

		result = &contracts.UnpublishResult{ApplicationID: appID, Status: app.Status}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// Rollback points the application's current version at a previously released
// version. The target version must belong to the application, be in
// "released" status, and have an immutable snapshot to serve at runtime.
func (s *PublishService) Rollback(ctx context.Context, tenantID, appID, versionID uuid.UUID) (*contracts.RollbackResult, error) {
	var result *contracts.RollbackResult
	err := s.store.WithTenant(ctx, tenantID).Transaction(ctx, func(session repositories.TenantSession) error {
		app, err := session.Applications().GetByID(ctx, appID)
		if err != nil {
			return fmt.Errorf("rollback: load application: %w", err)
		}
		if app.Status == "archived" {
			return fmt.Errorf("rollback: application is archived")
		}

		version, err := session.ApplicationVersions().GetByID(ctx, versionID)
		if err != nil {
			return fmt.Errorf("rollback: load version: %w", err)
		}
		if version.ApplicationID != appID {
			return fmt.Errorf("rollback: version does not belong to application")
		}
		if version.Status != "released" {
			return fmt.Errorf("rollback: version %s is not released (status=%s)", version.Version, version.Status)
		}

		snapshots, err := listSnapshotsByVersion(ctx, session, versionID)
		if err != nil {
			return err
		}
		if len(snapshots) == 0 {
			return fmt.Errorf("rollback: no snapshot found for version %s", version.Version)
		}

		app.CurrentVersionID = &version.ID
		app.Status = "published"
		if err := session.Applications().Update(ctx, app); err != nil {
			return fmt.Errorf("rollback: update application: %w", err)
		}

		result = &contracts.RollbackResult{
			ApplicationID: appID,
			VersionID:     version.ID,
			Version:       version.Version,
			Status:        app.Status,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// Deprecate marks a version as no longer supported. If the version is the
// application's current version, the application's pointer is cleared and
// its status reverts to draft so the deprecated version stops serving traffic.
func (s *PublishService) Deprecate(ctx context.Context, tenantID, appID, versionID uuid.UUID) (*contracts.DeprecateResult, error) {
	var result *contracts.DeprecateResult
	err := s.store.WithTenant(ctx, tenantID).Transaction(ctx, func(session repositories.TenantSession) error {
		app, err := session.Applications().GetByID(ctx, appID)
		if err != nil {
			return fmt.Errorf("deprecate: load application: %w", err)
		}

		version, err := session.ApplicationVersions().GetByID(ctx, versionID)
		if err != nil {
			return fmt.Errorf("deprecate: load version: %w", err)
		}
		if version.ApplicationID != appID {
			return fmt.Errorf("deprecate: version does not belong to application")
		}

		wasCurrent := app.CurrentVersionID != nil && *app.CurrentVersionID == version.ID

		version.Status = "deprecated"
		if err := session.ApplicationVersions().Update(ctx, version); err != nil {
			return fmt.Errorf("deprecate: update version: %w", err)
		}

		if wasCurrent {
			app.CurrentVersionID = nil
			app.Status = "draft"
			if err := session.Applications().Update(ctx, app); err != nil {
				return fmt.Errorf("deprecate: update application: %w", err)
			}
		}

		result = &contracts.DeprecateResult{
			ApplicationID:     appID,
			VersionID:         version.ID,
			Version:           version.Version,
			Status:            version.Status,
			ApplicationStatus: app.Status,
			WasCurrent:        wasCurrent,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (s *PublishService) ListVersions(ctx context.Context, tenantID, appID uuid.UUID, limit, offset int) ([]contracts.ApplicationVersionSummary, int64, error) {
	if _, err := s.store.WithTenant(ctx, tenantID).Applications().GetByID(ctx, appID); err != nil {
		return nil, 0, fmt.Errorf("list versions: application not found: %w", err)
	}

	versions, err := listVersionsByApplication(ctx, s.store.WithTenant(ctx, tenantID), appID, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	items := make([]contracts.ApplicationVersionSummary, 0, len(versions))
	for _, v := range versions {
		items = append(items, contracts.ApplicationVersionSummary{
			ID:        v.ID,
			Version:   v.Version,
			Status:    v.Status,
			CreatedOn: v.CreatedOn,
		})
	}
	return items, int64(len(items)), nil
}

func (s *PublishService) GetVersion(ctx context.Context, tenantID, appID, versionID uuid.UUID) (*contracts.ApplicationVersionDetail, error) {
	version, err := s.store.WithTenant(ctx, tenantID).ApplicationVersions().GetByID(ctx, versionID)
	if err != nil {
		return nil, fmt.Errorf("get version: %w", err)
	}
	if version.ApplicationID != appID {
		return nil, fmt.Errorf("get version: version does not belong to application")
	}

	snapshots, err := listSnapshotsByVersion(ctx, s.store.WithTenant(ctx, tenantID), versionID)
	if err != nil {
		return nil, err
	}

	snapshotSize := 0
	if len(snapshots) > 0 {
		snapshotSize = len(snapshots[0].SnapshotJSON)
	}

	var manifest any
	if len(version.Manifest) > 0 {
		_ = json.Unmarshal(version.Manifest, &manifest)
	}

	return &contracts.ApplicationVersionDetail{
		ApplicationVersionSummary: contracts.ApplicationVersionSummary{
			ID:        version.ID,
			Version:   version.Version,
			Status:    version.Status,
			CreatedOn: version.CreatedOn,
		},
		ApplicationID: version.ApplicationID,
		Manifest:      manifest,
		SnapshotSize:  snapshotSize,
	}, nil
}

func (s *PublishService) resolveVersionLabel(ctx context.Context, session repositories.TenantSession, appID uuid.UUID, requested *string) (string, error) {
	if requested != nil {
		label := strings.TrimSpace(*requested)
		if label == "" {
			return "", fmt.Errorf("publish: version label cannot be empty")
		}
		existing, err := listVersionsByApplication(ctx, session, appID, 0, 0)
		if err != nil {
			return "", err
		}
		for _, v := range existing {
			if v.Version == label {
				return "", fmt.Errorf("publish: version %s already exists", label)
			}
		}
		return label, nil
	}

	existing, err := listVersionsByApplication(ctx, session, appID, 0, 0)
	if err != nil {
		return "", err
	}
	if len(existing) == 0 {
		return "0.1.0", nil
	}

	latest := existing[0].Version
	for _, v := range existing[1:] {
		if compareSemver(v.Version, latest) > 0 {
			latest = v.Version
		}
	}
	next, err := bumpPatchVersion(latest)
	if err != nil {
		return "", fmt.Errorf("publish: compute next version: %w", err)
	}
	return next, nil
}

func listVersionsByApplication(ctx context.Context, session repositories.TenantSession, appID uuid.UUID, limit, offset int) ([]models.ApplicationVersion, error) {
	if repo, ok := any(session.ApplicationVersions()).(byFieldRepo[models.ApplicationVersion]); ok {
		items, err := repo.ListByField(ctx, "application_id", appID, limit, offset)
		if err != nil {
			return nil, fmt.Errorf("list versions: %w", err)
		}
		return items, nil
	}
	items, err := session.ApplicationVersions().List(ctx, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list versions: %w", err)
	}
	var filtered []models.ApplicationVersion
	for _, item := range items {
		if item.ApplicationID == appID {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

func listSnapshotsByVersion(ctx context.Context, session repositories.TenantSession, versionID uuid.UUID) ([]models.ApplicationSnapshot, error) {
	if repo, ok := any(session.ApplicationSnapshots()).(byFieldRepo[models.ApplicationSnapshot]); ok {
		items, err := repo.ListByField(ctx, "application_version_id", versionID, 0, 0)
		if err != nil {
			return nil, fmt.Errorf("list snapshots: %w", err)
		}
		return items, nil
	}
	items, err := session.ApplicationSnapshots().List(ctx, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("list snapshots: %w", err)
	}
	var filtered []models.ApplicationSnapshot
	for _, item := range items {
		if item.ApplicationVersionID == versionID {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

func buildPublishManifest(pkg *contracts.RuntimeApplication, notes *string) ([]byte, error) {
	controlCount := 0
	for _, screen := range pkg.Screens {
		controlCount += countControls(screen.Controls)
	}
	manifest := map[string]any{
		"screen_count":  len(pkg.Screens),
		"control_count": controlCount,
		"entity_count":  len(pkg.Entities),
		"published_at":  time.Now().UTC().Format(time.RFC3339),
	}
	if notes != nil && strings.TrimSpace(*notes) != "" {
		manifest["notes"] = strings.TrimSpace(*notes)
	}
	return json.Marshal(manifest)
}

func countControls(controls []contracts.RuntimeControl) int {
	total := len(controls)
	for _, control := range controls {
		total += countControls(control.Children)
	}
	return total
}

func bumpPatchVersion(version string) (string, error) {
	parts := strings.Split(version, ".")
	if len(parts) != 3 {
		return "", fmt.Errorf("unsupported version format %q", version)
	}
	major, err := strconv.Atoi(parts[0])
	if err != nil {
		return "", err
	}
	minor, err := strconv.Atoi(parts[1])
	if err != nil {
		return "", err
	}
	patch, err := strconv.Atoi(parts[2])
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%d.%d.%d", major, minor, patch+1), nil
}

func compareSemver(a, b string) int {
	ap := strings.Split(a, ".")
	bp := strings.Split(b, ".")
	for i := 0; i < 3; i++ {
		av, _ := strconv.Atoi(ap[i])
		bv, _ := strconv.Atoi(bp[i])
		if av > bv {
			return 1
		}
		if av < bv {
			return -1
		}
	}
	return 0
}
