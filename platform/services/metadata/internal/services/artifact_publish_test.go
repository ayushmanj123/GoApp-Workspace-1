package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"testing"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/services/fakes"
	"github.com/google/uuid"
)

// fakeBlobStore is an in-memory PublishArtifactUploader + PublishArtifactDownloader
// + PublishArtifactDeleter used to exercise the MinIO publish/runtime/GC paths
// without a real MinIO server.
type fakeBlobStore struct {
	blobs         map[string][]byte
	uploadErr     error
	downloadErr   error
	deleteErr     error
	uploadCalls   int
	downloadCalls int
	deleteCalls   int
	lastDeleted   string
}

func newFakeBlobStore() *fakeBlobStore {
	return &fakeBlobStore{blobs: map[string][]byte{}}
}

func (f *fakeBlobStore) Upload(ctx context.Context, objectKey string, data []byte, contentType string) (string, string, error) {
	f.uploadCalls++
	if f.uploadErr != nil {
		return "", "", f.uploadErr
	}
	url := "http://fake-minio/goapps-publish/" + objectKey
	stored := make([]byte, len(data))
	copy(stored, data)
	f.blobs[url] = stored
	sum := sha256.Sum256(data)
	return url, hex.EncodeToString(sum[:]), nil
}

func (f *fakeBlobStore) Download(ctx context.Context, objectURL string) ([]byte, error) {
	f.downloadCalls++
	if f.downloadErr != nil {
		return nil, f.downloadErr
	}
	data, ok := f.blobs[objectURL]
	if !ok {
		return nil, fmt.Errorf("fake blob store: object not found: %s", objectURL)
	}
	return data, nil
}

func (f *fakeBlobStore) Delete(ctx context.Context, objectURL string) error {
	f.deleteCalls++
	f.lastDeleted = objectURL
	if f.deleteErr != nil {
		return f.deleteErr
	}
	delete(f.blobs, objectURL)
	return nil
}

func setupPublishableApp(t *testing.T, store *fakes.FakeStore, tenantID, appID uuid.UUID) {
	t.Helper()
	screenID := uuid.New()
	ctx := context.Background()
	if err := store.Apps().Create(ctx, &models.Application{ID: appID, TenantID: tenantID, Name: "App", Status: "draft"}); err != nil {
		t.Fatalf("create app: %v", err)
	}
	if err := store.ScreensRepo().Create(ctx, &models.Screen{ID: screenID, TenantID: tenantID, ApplicationID: appID, Name: "Home", DisplayOrder: 0, LayoutType: "responsive"}); err != nil {
		t.Fatalf("create screen: %v", err)
	}
	if err := store.ControlsRepo().Create(ctx, &models.Control{ID: uuid.New(), TenantID: tenantID, ScreenID: screenID, Name: "Label1", ControlType: "label", Width: 10, Height: 10}); err != nil {
		t.Fatalf("create control: %v", err)
	}
}

func TestPublishUploadsArtifactAndRuntimePrefersIt(t *testing.T) {
	store := fakes.NewFakeStore()
	ctx := context.Background()
	tenantID := uuid.New()
	appID := uuid.New()
	setupPublishableApp(t, store, tenantID, appID)

	blobs := newFakeBlobStore()
	publishSvc := NewPublishService(store)
	publishSvc.artifacts = blobs

	result, err := publishSvc.Publish(ctx, tenantID, appID, PublishOptions{})
	if err != nil {
		t.Fatalf("publish failed: %v", err)
	}
	if blobs.uploadCalls != 1 {
		t.Fatalf("expected exactly one minio upload, got %d", blobs.uploadCalls)
	}

	packages, err := listPackagesByVersion(ctx, store.WithTenant(ctx, tenantID), result.VersionID)
	if err != nil {
		t.Fatalf("list packages: %v", err)
	}
	if len(packages) != 1 {
		t.Fatalf("expected one package row, got %d", len(packages))
	}
	if packages[0].PackageURL == "" || packages[0].PackageHash == "" {
		t.Fatalf("expected package url and hash to be set, got %#v", packages[0])
	}

	runtimeSvc := NewRuntimeService(store)
	runtimeSvc.artifacts = blobs
	pkg, err := runtimeSvc.BuildRuntimePackageWithOptions(ctx, tenantID, appID, RuntimePackageOptions{Channel: "published"})
	if err != nil {
		t.Fatalf("load published package: %v", err)
	}
	if blobs.downloadCalls != 1 {
		t.Fatalf("expected runtime to fetch the artifact from minio, got %d download calls", blobs.downloadCalls)
	}
	if len(pkg.Screens) != 1 || pkg.Screens[0].Name != "Home" {
		t.Fatalf("unexpected package content sourced from artifact: %#v", pkg.Screens)
	}
}

func TestPublishFallsBackWhenMinioUploadFails(t *testing.T) {
	store := fakes.NewFakeStore()
	ctx := context.Background()
	tenantID := uuid.New()
	appID := uuid.New()
	setupPublishableApp(t, store, tenantID, appID)

	blobs := newFakeBlobStore()
	blobs.uploadErr = errors.New("connection refused: minio unavailable")
	publishSvc := NewPublishService(store)
	publishSvc.artifacts = blobs

	result, err := publishSvc.Publish(ctx, tenantID, appID, PublishOptions{})
	if err != nil {
		t.Fatalf("expected publish to succeed even when minio is unavailable, got: %v", err)
	}

	packages, err := listPackagesByVersion(ctx, store.WithTenant(ctx, tenantID), result.VersionID)
	if err != nil {
		t.Fatalf("list packages: %v", err)
	}
	if len(packages) != 0 {
		t.Fatalf("expected no package row when minio upload fails, got %d", len(packages))
	}

	runtimeSvc := NewRuntimeService(store)
	runtimeSvc.artifacts = blobs
	pkg, err := runtimeSvc.BuildRuntimePackageWithOptions(ctx, tenantID, appID, RuntimePackageOptions{Channel: "published"})
	if err != nil {
		t.Fatalf("expected runtime to fall back to snapshot_json, got error: %v", err)
	}
	if blobs.downloadCalls != 0 {
		t.Fatalf("expected runtime to never attempt a minio download without a package row, got %d", blobs.downloadCalls)
	}
	if len(pkg.Screens) != 1 || pkg.Screens[0].Name != "Home" {
		t.Fatalf("unexpected package content sourced from snapshot fallback: %#v", pkg.Screens)
	}
}

func TestRuntimeFallsBackWhenArtifactDownloadFails(t *testing.T) {
	store := fakes.NewFakeStore()
	ctx := context.Background()
	tenantID := uuid.New()
	appID := uuid.New()
	setupPublishableApp(t, store, tenantID, appID)

	uploadBlobs := newFakeBlobStore()
	publishSvc := NewPublishService(store)
	publishSvc.artifacts = uploadBlobs
	result, err := publishSvc.Publish(ctx, tenantID, appID, PublishOptions{})
	if err != nil {
		t.Fatalf("publish failed: %v", err)
	}

	brokenDownloader := newFakeBlobStore()
	brokenDownloader.downloadErr = errors.New("minio: connection reset")
	runtimeSvc := NewRuntimeService(store)
	runtimeSvc.artifacts = brokenDownloader

	pkg, err := runtimeSvc.BuildRuntimePackageWithOptions(ctx, tenantID, appID, RuntimePackageOptions{Channel: "published"})
	if err != nil {
		t.Fatalf("expected runtime to fall back to snapshot_json on download failure, got error: %v", err)
	}
	if brokenDownloader.downloadCalls != 1 {
		t.Fatalf("expected exactly one (failed) download attempt, got %d", brokenDownloader.downloadCalls)
	}
	if len(pkg.Screens) != 1 || pkg.Screens[0].Name != "Home" {
		t.Fatalf("unexpected package content sourced from snapshot fallback: %#v", pkg.Screens)
	}
	_ = result
}

func TestRuntimeFallsBackOnArtifactHashMismatch(t *testing.T) {
	store := fakes.NewFakeStore()
	ctx := context.Background()
	tenantID := uuid.New()
	appID := uuid.New()
	setupPublishableApp(t, store, tenantID, appID)

	blobs := newFakeBlobStore()
	publishSvc := NewPublishService(store)
	publishSvc.artifacts = blobs
	result, err := publishSvc.Publish(ctx, tenantID, appID, PublishOptions{})
	if err != nil {
		t.Fatalf("publish failed: %v", err)
	}

	// Corrupt the stored blob so the sha256 recorded on the packages row no
	// longer matches what MinIO returns.
	for key := range blobs.blobs {
		blobs.blobs[key] = []byte(`{"tampered":true}`)
	}

	runtimeSvc := NewRuntimeService(store)
	runtimeSvc.artifacts = blobs
	pkg, err := runtimeSvc.BuildRuntimePackageWithOptions(ctx, tenantID, appID, RuntimePackageOptions{Channel: "published"})
	if err != nil {
		t.Fatalf("expected runtime to fall back to snapshot_json on hash mismatch, got error: %v", err)
	}
	if len(pkg.Screens) != 1 || pkg.Screens[0].Name != "Home" {
		t.Fatalf("unexpected package content after hash-mismatch fallback: %#v", pkg.Screens)
	}
	_ = result
}

func TestParseAndBuildObjectURLRoundTrip(t *testing.T) {
	store := &ArtifactStore{bucket: "goapps-publish", scheme: "http", endpoint: "localhost:9000"}
	objectKey := "applications/app-1/versions/v-1/snapshot.json"
	url := store.objectURL(objectKey)

	bucket, key, err := parseObjectURL(url)
	if err != nil {
		t.Fatalf("parse object url: %v", err)
	}
	if bucket != "goapps-publish" {
		t.Fatalf("expected bucket goapps-publish, got %s", bucket)
	}
	if key != objectKey {
		t.Fatalf("expected key %s, got %s", objectKey, key)
	}
}

func TestFakeBlobStoreDeleteRemovesObject(t *testing.T) {
	blobs := newFakeBlobStore()
	ctx := context.Background()
	url, _, err := blobs.Upload(ctx, "applications/a/versions/v/snapshot.json", []byte(`{"ok":true}`), "application/json")
	if err != nil {
		t.Fatalf("upload: %v", err)
	}
	if _, ok := blobs.blobs[url]; !ok {
		t.Fatalf("expected blob present after upload")
	}
	if err := blobs.Delete(ctx, url); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if blobs.deleteCalls != 1 {
		t.Fatalf("expected 1 delete call, got %d", blobs.deleteCalls)
	}
	if _, ok := blobs.blobs[url]; ok {
		t.Fatalf("expected blob removed after delete")
	}
	if blobs.lastDeleted != url {
		t.Fatalf("expected lastDeleted %s, got %s", url, blobs.lastDeleted)
	}
}

func TestDeprecateGCsUnreferencedArtifact(t *testing.T) {
	store := fakes.NewFakeStore()
	ctx := context.Background()
	tenantID := uuid.New()
	appID := uuid.New()
	setupPublishableApp(t, store, tenantID, appID)

	blobs := newFakeBlobStore()
	publishSvc := NewPublishService(store)
	publishSvc.artifacts = blobs

	published, err := publishSvc.Publish(ctx, tenantID, appID, PublishOptions{})
	if err != nil {
		t.Fatalf("publish failed: %v", err)
	}
	if blobs.uploadCalls != 1 {
		t.Fatalf("expected upload, got %d", blobs.uploadCalls)
	}
	packages, err := listPackagesByVersion(ctx, store.WithTenant(ctx, tenantID), published.VersionID)
	if err != nil || len(packages) != 1 {
		t.Fatalf("expected one package row before deprecate, got %d err=%v", len(packages), err)
	}
	artifactURL := packages[0].PackageURL

	if _, err := publishSvc.Deprecate(ctx, tenantID, appID, published.VersionID); err != nil {
		t.Fatalf("deprecate failed: %v", err)
	}
	if blobs.deleteCalls != 1 {
		t.Fatalf("expected artifact delete on unreferenced deprecate, got %d", blobs.deleteCalls)
	}
	if blobs.lastDeleted != artifactURL {
		t.Fatalf("expected deleted url %s, got %s", artifactURL, blobs.lastDeleted)
	}
	if _, ok := blobs.blobs[artifactURL]; ok {
		t.Fatalf("expected minio blob removed")
	}
	packagesAfter, err := listPackagesByVersion(ctx, store.WithTenant(ctx, tenantID), published.VersionID)
	if err != nil {
		t.Fatalf("list packages after deprecate: %v", err)
	}
	if len(packagesAfter) != 0 {
		t.Fatalf("expected packages row removed after GC, got %d", len(packagesAfter))
	}
}

func TestDeprecateSkipsGCWhenEnvironmentReferencesVersion(t *testing.T) {
	store := fakes.NewFakeStore()
	ctx := context.Background()
	tenantID := uuid.New()
	appID := uuid.New()
	setupPublishableApp(t, store, tenantID, appID)

	blobs := newFakeBlobStore()
	publishSvc := NewPublishService(store)
	publishSvc.artifacts = blobs

	published, err := publishSvc.Publish(ctx, tenantID, appID, PublishOptions{})
	if err != nil {
		t.Fatalf("publish failed: %v", err)
	}

	// Second publish so we can deprecate the older version while an env still
	// points at it (app current will move to the newer release).
	published2, err := publishSvc.Publish(ctx, tenantID, appID, PublishOptions{})
	if err != nil {
		t.Fatalf("second publish failed: %v", err)
	}
	_ = published2

	envID := uuid.New()
	if err := store.EnvironmentsRepo().Create(ctx, &models.Environment{
		ID:               envID,
		TenantID:         tenantID,
		ApplicationID:    appID,
		Name:             "test",
		EnvironmentType:  "test",
		CurrentVersionID: &published.VersionID,
	}); err != nil {
		t.Fatalf("create environment: %v", err)
	}

	packagesBefore, err := listPackagesByVersion(ctx, store.WithTenant(ctx, tenantID), published.VersionID)
	if err != nil || len(packagesBefore) != 1 {
		t.Fatalf("expected package for v1, got %d err=%v", len(packagesBefore), err)
	}

	if _, err := publishSvc.Deprecate(ctx, tenantID, appID, published.VersionID); err != nil {
		t.Fatalf("deprecate failed: %v", err)
	}
	if blobs.deleteCalls != 0 {
		t.Fatalf("expected no artifact delete while env references version, got %d", blobs.deleteCalls)
	}
	packagesAfter, err := listPackagesByVersion(ctx, store.WithTenant(ctx, tenantID), published.VersionID)
	if err != nil {
		t.Fatalf("list packages: %v", err)
	}
	if len(packagesAfter) != 1 {
		t.Fatalf("expected packages row retained, got %d", len(packagesAfter))
	}
	if _, ok := blobs.blobs[packagesBefore[0].PackageURL]; !ok {
		t.Fatalf("expected minio blob retained while env references version")
	}
}

func TestUnpublishDoesNotGCArtifact(t *testing.T) {
	store := fakes.NewFakeStore()
	ctx := context.Background()
	tenantID := uuid.New()
	appID := uuid.New()
	setupPublishableApp(t, store, tenantID, appID)

	blobs := newFakeBlobStore()
	publishSvc := NewPublishService(store)
	publishSvc.artifacts = blobs

	published, err := publishSvc.Publish(ctx, tenantID, appID, PublishOptions{})
	if err != nil {
		t.Fatalf("publish failed: %v", err)
	}

	if _, err := publishSvc.Unpublish(ctx, tenantID, appID); err != nil {
		t.Fatalf("unpublish failed: %v", err)
	}
	if blobs.deleteCalls != 0 {
		t.Fatalf("unpublish must not delete minio artifacts, got %d deletes", blobs.deleteCalls)
	}
	packages, err := listPackagesByVersion(ctx, store.WithTenant(ctx, tenantID), published.VersionID)
	if err != nil || len(packages) != 1 {
		t.Fatalf("expected package row retained after unpublish, got %d err=%v", len(packages), err)
	}
}

func TestArtifactStoreConfigFromEnvRequiresEndpoint(t *testing.T) {
	t.Setenv("MINIO_ENDPOINT", "")
	if _, ok := artifactStoreConfigFromEnv(); ok {
		t.Fatalf("expected artifact store to be considered unconfigured without MINIO_ENDPOINT")
	}

	t.Setenv("MINIO_ENDPOINT", "localhost:9000")
	t.Setenv("MINIO_PUBLISH_BUCKET", "")
	cfg, ok := artifactStoreConfigFromEnv()
	if !ok {
		t.Fatalf("expected artifact store to be configured when MINIO_ENDPOINT is set")
	}
	if cfg.Bucket != defaultPublishBucket {
		t.Fatalf("expected default bucket %s, got %s", defaultPublishBucket, cfg.Bucket)
	}
}
