package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
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
	store     repositories.Store
	runtime   *RuntimeService
	artifacts PublishArtifactUploader // nil => resolved from env via defaultArtifactStore at call time
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

		// Best-effort: mirror the snapshot into MinIO as a durable artifact and
		// record its URL/hash on the packages table. snapshot_json above
		// remains the source of truth — any failure here (MinIO unavailable,
		// packages write conflict, etc.) is logged and swallowed so publish
		// still succeeds using the database snapshot alone.
		s.publishArtifact(ctx, session, tenantID, appID, version.ID, snapshotJSON)

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
// status to draft. Existing versions, snapshots, and MinIO publish artifacts
// are left untouched — unpublish is pointer-only and never garbage-collects
// blobs (environments may still reference a version).
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
// After a successful deprecate, best-effort MinIO GC runs when the version is
// unreferenced by applications.current_version_id and every
// environments.current_version_id (see gcUnreferencedPublishArtifact).
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
	// Best-effort artifact GC after the deprecate transaction commits so we
	// observe the cleared application pointer. Failures never fail Deprecate.
	s.gcUnreferencedPublishArtifact(ctx, tenantID, appID, versionID)
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

// resolveArtifactUploader returns the configured uploader (test override
// wins) or the process-wide MinIO-backed default, which may be unavailable.
func (s *PublishService) resolveArtifactUploader() PublishArtifactUploader {
	if s.artifacts != nil {
		return s.artifacts
	}
	if store, ok := defaultArtifactStore(); ok {
		return store
	}
	return nil
}

// resolveArtifactDeleter returns a deleter when the injected artifacts store
// implements PublishArtifactDeleter, otherwise the process-wide MinIO default.
func (s *PublishService) resolveArtifactDeleter() PublishArtifactDeleter {
	if d, ok := s.artifacts.(PublishArtifactDeleter); ok {
		return d
	}
	if store, ok := defaultArtifactStore(); ok {
		return store
	}
	return nil
}

// versionHasLiveReferences reports whether the version is still pointed at by
// the application's current_version_id or any environment's current_version_id.
func versionHasLiveReferences(ctx context.Context, session repositories.TenantSession, appID, versionID uuid.UUID) (bool, error) {
	app, err := session.Applications().GetByID(ctx, appID)
	if err != nil {
		return false, fmt.Errorf("load application: %w", err)
	}
	if app.CurrentVersionID != nil && *app.CurrentVersionID == versionID {
		return true, nil
	}
	envs, err := listEnvironmentsByApplication(ctx, session, appID)
	if err != nil {
		return false, err
	}
	for _, env := range envs {
		if env.CurrentVersionID != nil && *env.CurrentVersionID == versionID {
			return true, nil
		}
	}
	return false, nil
}

// listEnvironmentsByApplication returns environments for an application.
func listEnvironmentsByApplication(ctx context.Context, session repositories.TenantSession, appID uuid.UUID) ([]models.Environment, error) {
	if repo, ok := any(session.Environments()).(byFieldRepo[models.Environment]); ok {
		items, err := repo.ListByField(ctx, "application_id", appID, 0, 0)
		if err != nil {
			return nil, fmt.Errorf("list environments: %w", err)
		}
		return items, nil
	}
	items, err := session.Environments().List(ctx, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("list environments: %w", err)
	}
	var filtered []models.Environment
	for _, item := range items {
		if item.ApplicationID == appID {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

// gcUnreferencedPublishArtifact deletes the MinIO object and packages row for
// a version when nothing still references it. snapshot_json is never deleted.
// All failures are logged and swallowed (matching publishArtifact soft-fail).
func (s *PublishService) gcUnreferencedPublishArtifact(ctx context.Context, tenantID, appID, versionID uuid.UUID) {
	session := s.store.WithTenant(ctx, tenantID)
	referenced, err := versionHasLiveReferences(ctx, session, appID, versionID)
	if err != nil {
		log.Printf("deprecate: artifact gc skipped for version %s: ref check failed: %v", versionID, err)
		return
	}
	if referenced {
		log.Printf("deprecate: artifact gc skipped for version %s: still referenced by app or environment", versionID)
		return
	}

	packages, err := listPackagesByVersion(ctx, session, versionID)
	if err != nil {
		log.Printf("deprecate: artifact gc skipped for version %s: list packages failed: %v", versionID, err)
		return
	}
	if len(packages) == 0 {
		return
	}

	deleter := s.resolveArtifactDeleter()
	for _, pkg := range packages {
		if pkg.PackageURL == "" {
			continue
		}
		if deleter == nil {
			log.Printf("deprecate: minio artifact store not configured; leaving package row for version %s", versionID)
			return
		}
		if err := deleter.Delete(ctx, pkg.PackageURL); err != nil {
			log.Printf("deprecate: minio delete failed for version %s url %s: %v", versionID, pkg.PackageURL, err)
			continue
		}
		// Remove the packages row after a successful blob delete. Clearing
		// package_url/package_hash in place is unsafe: package_hash is UNIQUE
		// NOT NULL. snapshot_json remains the runtime fallback.
		if err := session.Packages().Delete(ctx, pkg.ID); err != nil {
			log.Printf("deprecate: deleted minio object but failed to remove packages row %s for version %s: %v", pkg.ID, versionID, err)
		}
	}
}

// publishArtifact uploads the snapshot blob to MinIO and records its
// URL/hash on the packages table. It never returns an error: any failure
// (MinIO not configured, upload error, packages write conflict) is logged
// and swallowed so that Publish still succeeds with snapshot_json as the
// fallback source of truth for this version.
func (s *PublishService) publishArtifact(ctx context.Context, session repositories.TenantSession, tenantID, appID, versionID uuid.UUID, snapshotJSON []byte) {
	uploader := s.resolveArtifactUploader()
	if uploader == nil {
		log.Printf("publish: minio artifact store not configured for version %s; snapshot_json remains the source of truth", versionID)
		return
	}
	objectKey := fmt.Sprintf("applications/%s/versions/%s/snapshot.json", appID, versionID)
	objectURL, sha256Hex, err := uploader.Upload(ctx, objectKey, snapshotJSON, "application/json")
	if err != nil {
		log.Printf("publish: minio upload failed for version %s, falling back to snapshot_json: %v", versionID, err)
		return
	}
	pkg := &models.Package{
		TenantID:             tenantID,
		ApplicationVersionID: versionID,
		PackageURL:           objectURL,
		PackageHash:          sha256Hex,
	}
	if err := session.Packages().Create(ctx, pkg); err != nil {
		log.Printf("publish: uploaded artifact to minio but failed to persist package metadata for version %s: %v", versionID, err)
	}
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

// listPackagesByVersion returns publish artifact metadata rows (packages
// table) linked to a version. At most one row is expected per version.
func listPackagesByVersion(ctx context.Context, session repositories.TenantSession, versionID uuid.UUID) ([]models.Package, error) {
	if repo, ok := any(session.Packages()).(byFieldRepo[models.Package]); ok {
		items, err := repo.ListByField(ctx, "application_version_id", versionID, 0, 0)
		if err != nil {
			return nil, fmt.Errorf("list packages: %w", err)
		}
		return items, nil
	}
	items, err := session.Packages().List(ctx, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("list packages: %w", err)
	}
	var filtered []models.Package
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
		"screen_count":    len(pkg.Screens),
		"control_count":   controlCount,
		"entity_count":    len(pkg.Entities),
		"connector_count": len(pkg.Connectors),
		"published_at":    time.Now().UTC().Format(time.RFC3339),
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
