package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/goapps-platform/metadata-service/internal/api/contracts"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/google/uuid"
)

// RuntimePackageOptions controls how runtime packages are assembled.
type RuntimePackageOptions struct {
	Channel       string     // "published" (default) or "draft"; ignored when EnvironmentID is set
	EnvironmentID *uuid.UUID // when set, load snapshot for that env's current_version_id
}

var ErrEnvironmentNotPromoted = fmt.Errorf("environment has no promoted version")

// RuntimeService provides read-only runtime packages built from metadata.
type RuntimeService struct {
	store     repositories.Store
	artifacts PublishArtifactDownloader // nil => resolved from env via defaultArtifactStore at call time
}

// errNoPackageArtifact signals "no MinIO artifact recorded for this version",
// which is an expected, silent fallback path (e.g. MinIO was never
// configured, or this version predates Phase 8.1) rather than a failure.
var errNoPackageArtifact = errors.New("runtime: no package artifact recorded for version")

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
	return s.BuildRuntimePackageWithOptions(ctx, tenantID, appID, RuntimePackageOptions{})
}

func (s *RuntimeService) BuildRuntimePackageWithOptions(ctx context.Context, tenantID, appID uuid.UUID, opts RuntimePackageOptions) (*contracts.RuntimeApplication, error) {
	if opts.EnvironmentID != nil {
		return s.buildEnvironmentPackage(ctx, tenantID, appID, *opts.EnvironmentID)
	}

	channel := strings.TrimSpace(opts.Channel)
	if channel == "" {
		channel = "published"
	}
	if channel == "draft" {
		return s.buildDraftPackage(ctx, tenantID, appID)
	}
	if channel != "published" {
		return nil, fmt.Errorf("unsupported runtime channel %q", channel)
	}

	sess := s.store.WithTenant(ctx, tenantID)
	app, err := sess.Applications().GetByID(ctx, appID)
	if err != nil {
		return nil, fmt.Errorf("load application: %w", err)
	}
	if app.CurrentVersionID != nil {
		if pkg, err := s.loadPublishedPackage(ctx, sess, *app.CurrentVersionID); err == nil {
			return pkg, nil
		}
	}
	return s.buildDraftPackage(ctx, tenantID, appID)
}

func (s *RuntimeService) buildEnvironmentPackage(ctx context.Context, tenantID, appID, envID uuid.UUID) (*contracts.RuntimeApplication, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	if _, err := sess.Applications().GetByID(ctx, appID); err != nil {
		return nil, fmt.Errorf("load application: %w", err)
	}
	env, err := sess.Environments().GetByID(ctx, envID)
	if err != nil {
		return nil, fmt.Errorf("load environment: %w", err)
	}
	if env.ApplicationID != appID {
		return nil, ErrEnvironmentNotFound
	}
	if env.CurrentVersionID == nil {
		return nil, ErrEnvironmentNotPromoted
	}
	pkg, err := s.loadPublishedPackage(ctx, sess, *env.CurrentVersionID)
	if err != nil {
		return nil, fmt.Errorf("load environment version: %w", err)
	}
	return pkg, nil
}

func (s *RuntimeService) buildDraftPackage(ctx context.Context, tenantID, appID uuid.UUID) (*contracts.RuntimeApplication, error) {
	app, screens, controls, props, formulas, componentDefs, err := s.GetApplicationPackage(ctx, tenantID, appID)
	if err != nil {
		return nil, err
	}
	entitySvc := NewEntityService(s.store)
	entities, entityFields, err := entitySvc.LoadEntitiesWithFields(ctx, tenantID, appID)
	if err != nil {
		return nil, err
	}
	sess := s.store.WithTenant(ctx, tenantID)
	connectors, err := listConnectorsByApp(ctx, sess, tenantID, appID)
	if err != nil {
		return nil, fmt.Errorf("load connectors: %w", err)
	}
	connectorActions, err := s.loadConnectorActions(ctx, sess, tenantID, collectConnectorIDs(connectors))
	if err != nil {
		return nil, err
	}
	pkg, err := assembleRuntimeApplication(app, screens, controls, props, formulas, componentDefs, entities, entityFields, connectors, connectorActions)
	if err != nil {
		return nil, err
	}
	return pkg, nil
}

// loadPublishedPackage loads the frozen runtime package for a version,
// preferring the MinIO artifact (packages table) when one is present and
// fetchable, and falling back to the database snapshot_json otherwise.
// The DB snapshot remains the source of truth kept for at least one release
// so a MinIO outage or missing artifact never breaks runtime.
func (s *RuntimeService) loadPublishedPackage(ctx context.Context, sess repositories.TenantSession, versionID uuid.UUID) (*contracts.RuntimeApplication, error) {
	pkg, err := s.loadPackageArtifact(ctx, sess, versionID)
	if err == nil {
		return pkg, nil
	}
	if !errors.Is(err, errNoPackageArtifact) {
		log.Printf("runtime: package artifact load failed for version %s, falling back to snapshot_json: %v", versionID, err)
	}
	return s.loadPublishedSnapshot(ctx, sess, versionID)
}

// resolveArtifactDownloader returns the configured downloader (test override
// wins) or the process-wide MinIO-backed default, which may be unavailable.
func (s *RuntimeService) resolveArtifactDownloader() PublishArtifactDownloader {
	if s.artifacts != nil {
		return s.artifacts
	}
	if store, ok := defaultArtifactStore(); ok {
		return store
	}
	return nil
}

func (s *RuntimeService) loadPackageArtifact(ctx context.Context, sess repositories.TenantSession, versionID uuid.UUID) (*contracts.RuntimeApplication, error) {
	packages, err := listPackagesByVersion(ctx, sess, versionID)
	if err != nil {
		return nil, err
	}
	if len(packages) == 0 || strings.TrimSpace(packages[0].PackageURL) == "" {
		return nil, errNoPackageArtifact
	}
	row := packages[0]

	downloader := s.resolveArtifactDownloader()
	if downloader == nil {
		return nil, fmt.Errorf("runtime: minio artifact store not configured")
	}
	data, err := downloader.Download(ctx, row.PackageURL)
	if err != nil {
		return nil, fmt.Errorf("download package artifact: %w", err)
	}
	if strings.TrimSpace(row.PackageHash) != "" {
		sum := sha256.Sum256(data)
		if hex.EncodeToString(sum[:]) != row.PackageHash {
			return nil, fmt.Errorf("package artifact hash mismatch for version %s", versionID)
		}
	}
	var pkg contracts.RuntimeApplication
	if err := json.Unmarshal(data, &pkg); err != nil {
		return nil, fmt.Errorf("decode package artifact: %w", err)
	}
	return &pkg, nil
}

func (s *RuntimeService) loadPublishedSnapshot(ctx context.Context, sess repositories.TenantSession, versionID uuid.UUID) (*contracts.RuntimeApplication, error) {
	snapshots, err := listSnapshotsByVersion(ctx, sess, versionID)
	if err != nil {
		return nil, err
	}
	if len(snapshots) == 0 {
		return nil, fmt.Errorf("published snapshot not found")
	}
	var pkg contracts.RuntimeApplication
	if err := json.Unmarshal(snapshots[0].SnapshotJSON, &pkg); err != nil {
		return nil, fmt.Errorf("decode published snapshot: %w", err)
	}
	return &pkg, nil
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

func collectConnectorIDs(items []models.Connector) []uuid.UUID {
	ids := make([]uuid.UUID, 0, len(items))
	for _, it := range items {
		ids = append(ids, it.ID)
	}
	return ids
}

func (s *RuntimeService) loadConnectorActions(ctx context.Context, sess repositories.TenantSession, tenantID uuid.UUID, connectorIDs []uuid.UUID) ([]models.ConnectorAction, error) {
	if len(connectorIDs) == 0 {
		return nil, nil
	}
	if repo, ok := any(sess.ConnectorActions()).(byFieldInRepo[models.ConnectorAction]); ok {
		items, err := repo.ListByFieldIn(ctx, "connector_id", connectorIDs, 0, 0)
		if err != nil {
			return nil, fmt.Errorf("load connector actions: %w", err)
		}
		return items, nil
	}
	items, err := sess.ConnectorActions().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil {
		return nil, fmt.Errorf("load connector actions: %w", err)
	}
	connectorSet := map[uuid.UUID]struct{}{}
	for _, id := range connectorIDs {
		connectorSet[id] = struct{}{}
	}
	var filtered []models.ConnectorAction
	for _, it := range items {
		if _, ok := connectorSet[it.ConnectorID]; ok {
			filtered = append(filtered, it)
		}
	}
	return filtered, nil
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
