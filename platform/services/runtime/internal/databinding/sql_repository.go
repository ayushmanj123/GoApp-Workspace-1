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
	"gorm.io/gorm"
)

// SqlConnectorConfig is the resolved configuration for a SQL connector.
type SqlConnectorConfig struct {
	ConnectorID      uuid.UUID
	Name             string
	ConnectionString string
	Table            string
	PrimaryKey       string
}

type sqlAuthConfig struct {
	Type             string `json:"type"`
	SecretID         string `json:"secret_id,omitempty"`
	ConnectionString string `json:"connection_string,omitempty"`
	Table            string `json:"table,omitempty"`
	PrimaryKey       string `json:"primary_key,omitempty"`
}

type sqlConnectorRow struct {
	ID         uuid.UUID `gorm:"column:id"`
	Name       string    `gorm:"column:name"`
	AuthConfig []byte    `gorm:"column:auth_config"`
}

func (sqlConnectorRow) TableName() string { return "connectors" }

// SqlConnectorAction is a named SQL operation stored in connector_actions
// (endpoint holds the SELECT text; http_method is ignored at execution time).
type SqlConnectorAction struct {
	ActionName string
	HTTPMethod string
	Endpoint   string
}

// SqlConnectorRepository loads SQL connector configuration and optional actions.
type SqlConnectorRepository interface {
	GetConnectorConfig(ctx context.Context, tenantID, connectorID uuid.UUID) (*SqlConnectorConfig, error)
	GetAction(ctx context.Context, tenantID, connectorID uuid.UUID, actionName string) (*SqlConnectorAction, error)
}

// PostgresSqlConnectorRepository resolves SQL connectors from metadata tables.
type PostgresSqlConnectorRepository struct {
	db        *gorm.DB
	masterKey []byte
}

func NewPostgresSqlConnectorRepository(db *gorm.DB) *PostgresSqlConnectorRepository {
	key, err := secrets.LoadMasterKey(true)
	if err != nil {
		log.Printf("databinding: secrets master key unavailable: %v", err)
	}
	return &PostgresSqlConnectorRepository{db: db, masterKey: key}
}

func (r *PostgresSqlConnectorRepository) GetConnectorConfig(ctx context.Context, tenantID, connectorID uuid.UUID) (*SqlConnectorConfig, error) {
	var row sqlConnectorRow
	err := r.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ? AND connector_type = 'sql' AND deleted_at IS NULL", connectorID, tenantID).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrDataSourceNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("databinding: load sql connector: %w", err)
	}

	var auth sqlAuthConfig
	if len(row.AuthConfig) > 0 {
		if err := json.Unmarshal(row.AuthConfig, &auth); err != nil {
			return nil, fmt.Errorf("databinding: parse sql auth_config: %w", err)
		}
	}
	if err := ValidateSQLTableName(auth.Table); err != nil {
		return nil, err
	}
	if err := ValidateSQLPrimaryKey(auth.PrimaryKey); err != nil {
		return nil, err
	}

	dsn := strings.TrimSpace(auth.ConnectionString)
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
			return nil, fmt.Errorf("databinding: sql connector secret not found")
		}
		if err != nil {
			return nil, fmt.Errorf("databinding: load sql secret: %w", err)
		}
		plain, err := secrets.Decrypt(r.masterKey, sec.Ciphertext, sec.Nonce)
		if err != nil {
			return nil, fmt.Errorf("databinding: decrypt sql secret: %w", err)
		}
		dsn = string(plain)
	}
	if dsn == "" {
		return nil, fmt.Errorf("databinding: sql connector has no connection string")
	}

	return &SqlConnectorConfig{
		ConnectorID:      row.ID,
		Name:             row.Name,
		ConnectionString: dsn,
		Table:            strings.TrimSpace(auth.Table),
		PrimaryKey:       strings.TrimSpace(auth.PrimaryKey),
	}, nil
}

func (r *PostgresSqlConnectorRepository) GetAction(ctx context.Context, tenantID, connectorID uuid.UUID, actionName string) (*SqlConnectorAction, error) {
	var row restConnectorActionRow
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND connector_id = ? AND action_name = ?", tenantID, connectorID, actionName).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrRestActionNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("databinding: load sql connector action: %w", err)
	}
	return &SqlConnectorAction{
		ActionName: row.ActionName,
		HTTPMethod: row.HTTPMethod,
		Endpoint:   row.Endpoint,
	}, nil
}
