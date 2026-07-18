package databinding

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"

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
	GetConnectorConfig(ctx context.Context, tenantID, connectorID uuid.UUID) (*StorageConnectorConfig, error)
}

// PostgresStorageConnectorRepository resolves storage connectors from metadata tables.
type PostgresStorageConnectorRepository struct {
	db        *gorm.DB
	masterKey []byte
}

func NewPostgresStorageConnectorRepository(db *gorm.DB) *PostgresStorageConnectorRepository {
	key, err := secrets.LoadMasterKey(true)
	if err != nil {
		log.Printf("databinding: secrets master key unavailable: %v", err)
	}
	return &PostgresStorageConnectorRepository{db: db, masterKey: key}
}

func (r *PostgresStorageConnectorRepository) GetConnectorConfig(ctx context.Context, tenantID, connectorID uuid.UUID) (*StorageConnectorConfig, error) {
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
		if len(r.masterKey) == 0 {
			return nil, fmt.Errorf("databinding: secrets master key is not configured")
		}
		secretUUID, err := uuid.Parse(auth.SecretID)
		if err != nil {
			return nil, fmt.Errorf("databinding: invalid secret_id: %w", err)
		}
		var sec secretRow
		err = r.db.WithContext(ctx).
			Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", secretUUID, tenantID).
			First(&sec).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("databinding: storage connector secret not found")
		}
		if err != nil {
			return nil, fmt.Errorf("databinding: load storage secret: %w", err)
		}
		plain, err := secrets.Decrypt(r.masterKey, sec.Ciphertext, sec.Nonce)
		if err != nil {
			return nil, fmt.Errorf("databinding: decrypt storage secret: %w", err)
		}
		secretKey = string(plain)
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

// StorageDataSource lists/gets objects from an S3-compatible bucket (MinIO).
type StorageDataSource struct {
	repo       StorageConnectorRepository
	newClient  func(cfg *StorageConnectorConfig) (*minio.Client, error)
}

func NewStorageDataSource(repo StorageConnectorRepository) *StorageDataSource {
	return &StorageDataSource{
		repo: repo,
		newClient: func(cfg *StorageConnectorConfig) (*minio.Client, error) {
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
	cfg, err := d.repo.GetConnectorConfig(ctx, input.TenantID, input.EntityID)
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
	cfg, err := d.repo.GetConnectorConfig(ctx, tenantID, key.EntityID)
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

func (d *StorageDataSource) Create(context.Context, uuid.UUID, uuid.UUID, DataSourceKey, map[string]interface{}) (*DataItem, error) {
	return nil, fmt.Errorf("databinding: storage create is not supported")
}

func (d *StorageDataSource) Update(context.Context, uuid.UUID, uuid.UUID, DataSourceKey, uuid.UUID, map[string]interface{}, int) (*DataItem, error) {
	return nil, fmt.Errorf("databinding: storage update is not supported")
}

func (d *StorageDataSource) Delete(context.Context, uuid.UUID, uuid.UUID, DataSourceKey, uuid.UUID) error {
	return fmt.Errorf("databinding: storage delete is not supported")
}
