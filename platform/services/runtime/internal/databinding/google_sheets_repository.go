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

// GoogleSheetsConnectorConfig is the resolved configuration for a Google Sheets connector.
type GoogleSheetsConnectorConfig struct {
	ConnectorID   uuid.UUID
	Name          string
	SpreadsheetID string
	SheetName     string
	HeaderRow     int
	KeyColumn     string
	Auth          RestAuthConfig
}

type googleSheetsAuthConfig struct {
	Type             string `json:"type"`
	SecretID         string `json:"secret_id,omitempty"`
	RefreshSecretID  string `json:"refresh_secret_id,omitempty"`
	TokenURL         string `json:"token_url,omitempty"`
	AuthorizationURL string `json:"authorization_url,omitempty"`
	ClientID         string `json:"client_id,omitempty"`
	Scope            string `json:"scope,omitempty"`
	ConnectionScope  string `json:"connection_scope,omitempty"`
	SpreadsheetID    string `json:"spreadsheet_id,omitempty"`
	SheetName        string `json:"sheet_name,omitempty"`
	HeaderRow        int    `json:"header_row,omitempty"`
	KeyColumn        string `json:"key_column,omitempty"`
}

type googleSheetsConnectorRow struct {
	ID                 uuid.UUID `gorm:"column:id"`
	Name               string    `gorm:"column:name"`
	AuthenticationType string    `gorm:"column:authentication_type"`
	AuthConfig         []byte    `gorm:"column:auth_config"`
}

func (googleSheetsConnectorRow) TableName() string { return "connectors" }

// GoogleSheetsConnectorRepository loads Google Sheets connector configuration.
type GoogleSheetsConnectorRepository interface {
	GetConnectorConfig(ctx context.Context, tenantID, connectorID uuid.UUID, environmentID *uuid.UUID, userID uuid.UUID) (*GoogleSheetsConnectorConfig, error)
}

// PostgresGoogleSheetsConnectorRepository resolves google_sheets connectors from metadata tables.
type PostgresGoogleSheetsConnectorRepository struct {
	db        *gorm.DB
	masterKey []byte
}

func NewPostgresGoogleSheetsConnectorRepository(db *gorm.DB) *PostgresGoogleSheetsConnectorRepository {
	key, err := secrets.LoadMasterKey(true)
	if err != nil {
		log.Printf("databinding: secrets master key unavailable: %v", err)
	}
	return &PostgresGoogleSheetsConnectorRepository{db: db, masterKey: key}
}

func (r *PostgresGoogleSheetsConnectorRepository) GetConnectorConfig(ctx context.Context, tenantID, connectorID uuid.UUID, environmentID *uuid.UUID, userID uuid.UUID) (*GoogleSheetsConnectorConfig, error) {
	var row googleSheetsConnectorRow
	err := r.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ? AND connector_type = 'google_sheets' AND deleted_at IS NULL", connectorID, tenantID).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrDataSourceNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("databinding: load google sheets connector: %w", err)
	}

	var raw googleSheetsAuthConfig
	if len(row.AuthConfig) > 0 {
		if err := json.Unmarshal(row.AuthConfig, &raw); err != nil {
			return nil, fmt.Errorf("databinding: parse google sheets auth_config: %w", err)
		}
	}
	auth := RestAuthConfig{
		Type:            raw.Type,
		SecretID:        raw.SecretID,
		RefreshSecretID: raw.RefreshSecretID,
		TokenURL:        raw.TokenURL,
		ClientID:        raw.ClientID,
		Scope:           raw.Scope,
		ConnectionScope: raw.ConnectionScope,
	}
	if auth.Type == "" {
		auth.Type = row.AuthenticationType
	}
	restRepo := &PostgresRestConnectorRepository{db: r.db, masterKey: r.masterKey}
	if err := restRepo.resolveAuthSecret(ctx, tenantID, connectorID, environmentID, userID, &auth); err != nil {
		return nil, err
	}

	headerRow := raw.HeaderRow
	if headerRow <= 0 {
		headerRow = 1
	}
	return &GoogleSheetsConnectorConfig{
		ConnectorID:   row.ID,
		Name:          row.Name,
		SpreadsheetID: strings.TrimSpace(raw.SpreadsheetID),
		SheetName:     strings.TrimSpace(raw.SheetName),
		HeaderRow:     headerRow,
		KeyColumn:     strings.TrimSpace(raw.KeyColumn),
		Auth:          auth,
	}, nil
}
