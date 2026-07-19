package services

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// defaultPublishBucket is used when MINIO_PUBLISH_BUCKET is not set.
const defaultPublishBucket = "goapps-publish"

// PublishArtifactUploader uploads an immutable publish artifact blob and
// returns a durable URL plus a sha256 hex digest of the uploaded bytes.
type PublishArtifactUploader interface {
	Upload(ctx context.Context, objectKey string, data []byte, contentType string) (objectURL string, sha256Hex string, err error)
}

// PublishArtifactDownloader fetches a previously uploaded publish artifact
// blob given the URL returned by PublishArtifactUploader.Upload.
type PublishArtifactDownloader interface {
	Download(ctx context.Context, objectURL string) ([]byte, error)
}

// PublishArtifactDeleter removes a previously uploaded publish artifact blob.
type PublishArtifactDeleter interface {
	Delete(ctx context.Context, objectURL string) error
}

// ArtifactStoreConfig is the resolved MinIO configuration used to store
// publish artifacts (application snapshot blobs).
type ArtifactStoreConfig struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	UseSSL    bool
}

// artifactStoreConfigFromEnv loads MinIO configuration from the environment
// variables already documented in .env.example / docker-compose. Returns
// ok=false when MINIO_ENDPOINT is unset, meaning MinIO is simply not
// configured for this deployment (a normal, non-error condition locally).
func artifactStoreConfigFromEnv() (ArtifactStoreConfig, bool) {
	endpoint := strings.TrimSpace(os.Getenv("MINIO_ENDPOINT"))
	if endpoint == "" {
		return ArtifactStoreConfig{}, false
	}
	bucket := strings.TrimSpace(os.Getenv("MINIO_PUBLISH_BUCKET"))
	if bucket == "" {
		bucket = defaultPublishBucket
	}
	useSSL, _ := strconv.ParseBool(strings.TrimSpace(os.Getenv("MINIO_USE_SSL")))
	return ArtifactStoreConfig{
		Endpoint:  endpoint,
		AccessKey: strings.TrimSpace(os.Getenv("MINIO_ACCESS_KEY")),
		SecretKey: strings.TrimSpace(os.Getenv("MINIO_SECRET_KEY")),
		Bucket:    bucket,
		UseSSL:    useSSL,
	}, true
}

// ArtifactStore uploads/downloads immutable publish artifacts (application
// snapshot blobs) to/from a MinIO (S3-compatible) bucket. It implements both
// PublishArtifactUploader and PublishArtifactDownloader.
type ArtifactStore struct {
	client   *minio.Client
	bucket   string
	scheme   string
	endpoint string
}

// NewArtifactStore builds an ArtifactStore from explicit config. It does not
// contact MinIO; connectivity/bucket errors surface lazily on Upload/Download.
func NewArtifactStore(cfg ArtifactStoreConfig) (*ArtifactStore, error) {
	endpoint := strings.TrimSpace(cfg.Endpoint)
	bucket := strings.TrimSpace(cfg.Bucket)
	if endpoint == "" || bucket == "" {
		return nil, fmt.Errorf("artifact store: endpoint and bucket are required")
	}
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("artifact store: create client: %w", err)
	}
	scheme := "http"
	if cfg.UseSSL {
		scheme = "https"
	}
	return &ArtifactStore{client: client, bucket: bucket, scheme: scheme, endpoint: endpoint}, nil
}

var (
	artifactStoreOnce      sync.Once
	artifactStoreSingleton *ArtifactStore
	artifactStoreAvailable bool
)

// defaultArtifactStore lazily builds a process-wide ArtifactStore from
// environment configuration. ok=false means MinIO is not configured (or
// failed to initialize) — callers must treat that as "unavailable" rather
// than a hard failure, keeping snapshot_json as the source of truth.
func defaultArtifactStore() (*ArtifactStore, bool) {
	artifactStoreOnce.Do(func() {
		cfg, ok := artifactStoreConfigFromEnv()
		if !ok {
			return
		}
		store, err := NewArtifactStore(cfg)
		if err != nil {
			log.Printf("artifact store: disabled: %v", err)
			return
		}
		artifactStoreSingleton = store
		artifactStoreAvailable = true
	})
	return artifactStoreSingleton, artifactStoreAvailable
}

// ensureBucket creates the target bucket if it does not already exist.
func (s *ArtifactStore) ensureBucket(ctx context.Context) error {
	exists, err := s.client.BucketExists(ctx, s.bucket)
	if err != nil {
		return fmt.Errorf("artifact store: check bucket: %w", err)
	}
	if exists {
		return nil
	}
	if err := s.client.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{}); err != nil {
		// Tolerate a benign race where another instance created it first.
		if stillExists, checkErr := s.client.BucketExists(ctx, s.bucket); checkErr == nil && stillExists {
			return nil
		}
		return fmt.Errorf("artifact store: create bucket %q: %w", s.bucket, err)
	}
	return nil
}

// Upload stores data under objectKey, creating the bucket if needed, and
// returns a durable object URL plus the sha256 hex digest of data.
func (s *ArtifactStore) Upload(ctx context.Context, objectKey string, data []byte, contentType string) (objectURL string, sha256Hex string, err error) {
	if s == nil || s.client == nil {
		return "", "", fmt.Errorf("artifact store: not configured")
	}
	if err := s.ensureBucket(ctx); err != nil {
		return "", "", err
	}
	sum := sha256.Sum256(data)
	sha256Hex = hex.EncodeToString(sum[:])
	if _, err := s.client.PutObject(ctx, s.bucket, objectKey, bytes.NewReader(data), int64(len(data)), minio.PutObjectOptions{
		ContentType: contentType,
	}); err != nil {
		return "", "", fmt.Errorf("artifact store: upload %q: %w", objectKey, err)
	}
	return s.objectURL(objectKey), sha256Hex, nil
}

func (s *ArtifactStore) objectURL(objectKey string) string {
	u := url.URL{
		Scheme: s.scheme,
		Host:   s.endpoint,
		Path:   "/" + s.bucket + "/" + objectKey,
	}
	return u.String()
}

// Download fetches the object referenced by objectURL, as previously
// returned by Upload.
func (s *ArtifactStore) Download(ctx context.Context, objectURL string) ([]byte, error) {
	if s == nil || s.client == nil {
		return nil, fmt.Errorf("artifact store: not configured")
	}
	bucket, key, err := parseObjectURL(objectURL)
	if err != nil {
		return nil, err
	}
	obj, err := s.client.GetObject(ctx, bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("artifact store: get object %q: %w", key, err)
	}
	defer obj.Close()
	data, err := io.ReadAll(obj)
	if err != nil {
		return nil, fmt.Errorf("artifact store: read object %q: %w", key, err)
	}
	return data, nil
}

// Delete removes the object referenced by objectURL, as previously returned by Upload.
func (s *ArtifactStore) Delete(ctx context.Context, objectURL string) error {
	if s == nil || s.client == nil {
		return fmt.Errorf("artifact store: not configured")
	}
	bucket, key, err := parseObjectURL(objectURL)
	if err != nil {
		return err
	}
	if err := s.client.RemoveObject(ctx, bucket, key, minio.RemoveObjectOptions{}); err != nil {
		return fmt.Errorf("artifact store: remove object %q: %w", key, err)
	}
	return nil
}

// parseObjectURL extracts the bucket and object key from a URL produced by
// ArtifactStore.objectURL (path shape: /{bucket}/{objectKey...}).
func parseObjectURL(raw string) (bucket, key string, err error) {
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", "", fmt.Errorf("artifact store: parse url %q: %w", raw, err)
	}
	trimmed := strings.TrimPrefix(parsed.Path, "/")
	parts := strings.SplitN(trimmed, "/", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", "", fmt.Errorf("artifact store: malformed object url %q", raw)
	}
	return parts[0], parts[1], nil
}
