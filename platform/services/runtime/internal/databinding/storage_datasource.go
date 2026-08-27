package databinding

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"github.com/goapps-platform/shared/secrets"
	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"gorm.io/gorm"
)

// StorageConnectorConfig is the resolved S3/MinIO connector configuration.
type StorageConnectorConfig struct {
	ConnectorID   uuid.UUID
	Name          string
	Endpoint      string
	Bucket        string
	AccessKeyID   string
	SecretKey     string
	UseSSL        bool
	Prefix        string
}

type storageAuthConfig struct {
	Type            string `json:"type"`
	SecretID        string `json:"secret_id,omitempty"`
	Endpoint        string `json:"endpoint,omitempty"`
	Bucket          string `json:"bucket,omitempty"`
	AccessKeyID     string `json:"access_key_id,omitempty"`
	SecretAccessKey string `json:"secret_access_key,omitempty"`
	UseSSL          *bool  `json:"use_ssl,omitempty"`
	Prefix          string `json:"prefix,omitempty"`
}

type storageConnectorRow struct {
	ID         uuid.UUID `gorm:"column:id"`
	Name       string    `gorm:"column:name"`
	AuthConfig []byte    `gorm:"column:auth_config"`
}

func (storageConnectorRow) TableName() string { return "connectors" }

// StorageConnectorRepository loads storage connector configuration.
type StorageConnectorRepository interface {
	GetConnectorConfig(ctx context.Context, tenantID, connectorID uuid.UUID, environmentID *uuid.UUID) (*StorageConnectorConfig, error)
}

// PostgresStorageConnectorRepository resolves storage connectors from metadata tables.
type PostgresStorageConnectorRepository struct {
	db        *gorm.DB
	masterKey []byte
}

func NewPostgresStorageConnectorRepository(db *gorm.DB) *PostgresStorageConnectorRepository {
	key, err := secrets.LoadMasterKeyFromEnv()
	if err != nil {
		log.Printf("databinding: secrets master key unavailable: %v", err)
	}
	return &PostgresStorageConnectorRepository{db: db, masterKey: key}
}

func (r *PostgresStorageConnectorRepository) GetConnectorConfig(ctx context.Context, tenantID, connectorID uuid.UUID, environmentID *uuid.UUID) (*StorageConnectorConfig, error) {
	var row storageConnectorRow
	err := r.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ? AND connector_type = 'storage' AND deleted_at IS NULL", connectorID, tenantID).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrDataSourceNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("databinding: load storage connector: %w", err)
	}

	var auth storageAuthConfig
	if len(row.AuthConfig) > 0 {
		if err := json.Unmarshal(row.AuthConfig, &auth); err != nil {
			return nil, fmt.Errorf("databinding: parse storage auth_config: %w", err)
		}
	}

	secretKey := strings.TrimSpace(auth.SecretAccessKey)
	if auth.SecretID != "" {
		secretUUID, err := uuid.Parse(auth.SecretID)
		if err != nil {
			return nil, fmt.Errorf("databinding: invalid secret_id: %w", err)
		}
		plain, err := decryptSecretPlaintext(ctx, r.db, r.masterKey, tenantID, secretUUID, environmentID)
		if err != nil {
			return nil, err
		}
		secretKey = plain
	}
	if strings.TrimSpace(auth.Endpoint) == "" || strings.TrimSpace(auth.Bucket) == "" {
		return nil, fmt.Errorf("databinding: storage connector requires endpoint and bucket")
	}
	if strings.TrimSpace(auth.AccessKeyID) == "" || secretKey == "" {
		return nil, fmt.Errorf("databinding: storage connector requires access keys")
	}
	useSSL := false
	if auth.UseSSL != nil {
		useSSL = *auth.UseSSL
	}

	return &StorageConnectorConfig{
		ConnectorID: row.ID,
		Name:        row.Name,
		Endpoint:    strings.TrimSpace(auth.Endpoint),
		Bucket:      strings.TrimSpace(auth.Bucket),
		AccessKeyID: strings.TrimSpace(auth.AccessKeyID),
		SecretKey:   secretKey,
		UseSSL:      useSSL,
		Prefix:      strings.TrimSpace(auth.Prefix),
	}, nil
}

// storageClient is the subset of MinIO operations used by StorageDataSource.
type storageClient interface {
	PutObject(ctx context.Context, bucketName, objectName string, reader io.Reader, objectSize int64, opts minio.PutObjectOptions) (minio.UploadInfo, error)
	RemoveObject(ctx context.Context, bucketName, objectName string, opts minio.RemoveObjectOptions) error
	StatObject(ctx context.Context, bucketName, objectName string, opts minio.StatObjectOptions) (minio.ObjectInfo, error)
	ListObjects(ctx context.Context, bucketName string, opts minio.ListObjectsOptions) <-chan minio.ObjectInfo
}

// StorageDataSource lists/gets/creates/deletes objects in an S3-compatible bucket (MinIO).
type StorageDataSource struct {
	repo      StorageConnectorRepository
	newClient func(cfg *StorageConnectorConfig) (storageClient, error)
}

func NewStorageDataSource(repo StorageConnectorRepository) *StorageDataSource {
	return &StorageDataSource{
		repo: repo,
		newClient: func(cfg *StorageConnectorConfig) (storageClient, error) {
			return minio.New(cfg.Endpoint, &minio.Options{
				Creds:  credentials.NewStaticV4(cfg.AccessKeyID, cfg.SecretKey, ""),
				Secure: cfg.UseSSL,
			})
		},
	}
}

func (d *StorageDataSource) Kind() DataSourceKind {
	return DataSourceKindStorage
}

func (d *StorageDataSource) Query(ctx context.Context, input QueryInput) (*QueryResult, error) {
	if d == nil || d.repo == nil {
		return nil, fmt.Errorf("databinding: storage datasource is not configured")
	}
	cfg, err := d.repo.GetConnectorConfig(ctx, input.TenantID, input.EntityID, coalesceEnvironmentID(input.EnvironmentID, ctx))
	if err != nil {
		return nil, err
	}
	client, err := d.newClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("databinding: create storage client: %w", err)
	}

	limit := input.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	offset := input.Offset
	if offset < 0 {
		offset = 0
	}

	opts := minio.ListObjectsOptions{
		Prefix:    cfg.Prefix,
		Recursive: true,
	}
	items := make([]DataItem, 0, limit)
	skipped := 0
	for obj := range client.ListObjects(ctx, cfg.Bucket, opts) {
		if obj.Err != nil {
			return nil, fmt.Errorf("databinding: list storage objects: %w", obj.Err)
		}
		if skipped < offset {
			skipped++
			continue
		}
		if len(items) >= limit {
			break
		}
		items = append(items, DataItem{
			"id":            obj.Key,
			"key":           obj.Key,
			"size":          obj.Size,
			"last_modified": obj.LastModified,
			"etag":          obj.ETag,
		})
	}
	return &QueryResult{Items: items, Count: int64(len(items))}, nil
}

func (d *StorageDataSource) Get(ctx context.Context, tenantID, _ uuid.UUID, key DataSourceKey, recordID uuid.UUID) (*DataItem, error) {
	if d == nil || d.repo == nil {
		return nil, fmt.Errorf("databinding: storage datasource is not configured")
	}
	cfg, err := d.repo.GetConnectorConfig(ctx, tenantID, key.EntityID, EnvironmentIDFromContext(ctx))
	if err != nil {
		return nil, err
	}
	client, err := d.newClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("databinding: create storage client: %w", err)
	}
	objectKey := recordID.String()
	info, err := client.StatObject(ctx, cfg.Bucket, objectKey, minio.StatObjectOptions{})
	if err != nil {
		return nil, ErrDataSourceNotFound
	}
	item := DataItem{
		"id":            info.Key,
		"key":           info.Key,
		"size":          info.Size,
		"last_modified": info.LastModified,
		"etag":          info.ETag,
		"content_type":  info.ContentType,
	}
	return &item, nil
}

func (d *StorageDataSource) Create(ctx context.Context, tenantID, _ uuid.UUID, key DataSourceKey, data map[string]interface{}) (*DataItem, error) {
	if d == nil || d.repo == nil {
		return nil, fmt.Errorf("databinding: storage datasource is not configured")
	}
	cfg, err := d.repo.GetConnectorConfig(ctx, tenantID, key.EntityID, EnvironmentIDFromContext(ctx))
	if err != nil {
		return nil, err
	}
	body, contentType, err := decodeStorageContent(data)
	if err != nil {
		return nil, err
	}
	objectKey := applyStoragePrefix(cfg.Prefix, storagePayloadKey(data))
	if objectKey == "" {
		objectKey = applyStoragePrefix(cfg.Prefix, uuid.New().String())
	}

	client, err := d.newClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("databinding: create storage client: %w", err)
	}
	info, err := client.PutObject(ctx, cfg.Bucket, objectKey, bytes.NewReader(body), int64(len(body)), minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return nil, fmt.Errorf("databinding: put storage object: %w", err)
	}

	item := DataItem{
		"id":            objectKey,
		"key":           objectKey,
		"size":          int64(len(body)),
		"etag":          info.ETag,
		"content_type":  contentType,
		"last_modified": time.Now().UTC(),
	}
	if info.Size > 0 {
		item["size"] = info.Size
	}
	return &item, nil
}

func (d *StorageDataSource) Update(context.Context, uuid.UUID, uuid.UUID, DataSourceKey, uuid.UUID, map[string]interface{}, int) (*DataItem, error) {
	return nil, fmt.Errorf("databinding: storage update is not supported")
}

func (d *StorageDataSource) Delete(ctx context.Context, tenantID, userID uuid.UUID, key DataSourceKey, recordID uuid.UUID) error {
	return d.DeleteByObjectKey(ctx, tenantID, userID, key, recordID.String())
}

// DeleteByObjectKey removes an object by its string key (Gallery id/key or explicit key).
func (d *StorageDataSource) DeleteByObjectKey(ctx context.Context, tenantID, _ uuid.UUID, key DataSourceKey, objectKey string) error {
	if d == nil || d.repo == nil {
		return fmt.Errorf("databinding: storage datasource is not configured")
	}
	objectKey = strings.TrimSpace(objectKey)
	if objectKey == "" {
		return fmt.Errorf("databinding: storage object key is required")
	}
	cfg, err := d.repo.GetConnectorConfig(ctx, tenantID, key.EntityID, EnvironmentIDFromContext(ctx))
	if err != nil {
		return err
	}
	objectKey = applyStoragePrefix(cfg.Prefix, objectKey)
	client, err := d.newClient(cfg)
	if err != nil {
		return fmt.Errorf("databinding: create storage client: %w", err)
	}
	if _, err := client.StatObject(ctx, cfg.Bucket, objectKey, minio.StatObjectOptions{}); err != nil {
		return ErrDataSourceNotFound
	}
	if err := client.RemoveObject(ctx, cfg.Bucket, objectKey, minio.RemoveObjectOptions{}); err != nil {
		return fmt.Errorf("databinding: remove storage object: %w", err)
	}
	return nil
}

func storagePayloadKey(data map[string]interface{}) string {
	if data == nil {
		return ""
	}
	if raw, ok := data["key"]; ok {
		return strings.TrimSpace(fmt.Sprint(raw))
	}
	if raw, ok := data["id"]; ok {
		return strings.TrimSpace(fmt.Sprint(raw))
	}
	return ""
}

func applyStoragePrefix(prefix, key string) string {
	key = strings.TrimSpace(key)
	prefix = strings.TrimSpace(prefix)
	if key == "" {
		return ""
	}
	if prefix == "" || strings.HasPrefix(key, prefix) {
		return key
	}
	return prefix + key
}

func decodeStorageContent(data map[string]interface{}) ([]byte, string, error) {
	if data == nil {
		return nil, "", fmt.Errorf("databinding: storage create requires content")
	}
	raw, ok := data["content"]
	if !ok || raw == nil {
		return nil, "", fmt.Errorf("databinding: storage create requires content")
	}

	contentType := "text/plain; charset=utf-8"
	if ct, hasCT := data["content_type"]; hasCT && strings.TrimSpace(fmt.Sprint(ct)) != "" {
		contentType = strings.TrimSpace(fmt.Sprint(ct))
	}

	encoding := ""
	if enc, hasEnc := data["content_encoding"]; hasEnc {
		encoding = strings.ToLower(strings.TrimSpace(fmt.Sprint(enc)))
	}

	switch typed := raw.(type) {
	case []byte:
		if encoding == "base64" {
			decoded, err := base64.StdEncoding.DecodeString(string(typed))
			if err != nil {
				return nil, "", fmt.Errorf("databinding: invalid base64 content: %w", err)
			}
			if contentType == "text/plain; charset=utf-8" {
				contentType = "application/octet-stream"
			}
			return decoded, contentType, nil
		}
		return typed, contentType, nil
	default:
		text := fmt.Sprint(typed)
		if encoding == "base64" {
			decoded, err := base64.StdEncoding.DecodeString(text)
			if err != nil {
				return nil, "", fmt.Errorf("databinding: invalid base64 content: %w", err)
			}
			if _, hasCT := data["content_type"]; !hasCT {
				contentType = "application/octet-stream"
			}
			return decoded, contentType, nil
		}
		return []byte(text), contentType, nil
	}
}
