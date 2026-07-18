package databinding

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"

	"github.com/goapps-platform/shared/secrets"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ErrRestActionNotFound is returned when a connector has no action configured
// for the requested convention name (list/get/create/update/delete).
var ErrRestActionNotFound = errors.New("databinding: rest connector action not found")

var legacyHeaderValueOnce sync.Once

// RestAuthConfig is the parsed connectors.auth_config JSON payload.
// Supports none, header (static), and oauth_client_credentials.
type RestAuthConfig struct {
	Type         string `json:"type"`
	HeaderName   string `json:"header_name,omitempty"`
	HeaderValue  string `json:"header_value,omitempty"`
	SecretID     string `json:"secret_id,omitempty"`
	TokenURL     string `json:"token_url,omitempty"`
	ClientID     string `json:"client_id,omitempty"`
	ClientSecret string `json:"client_secret,omitempty"`
	Scope        string `json:"scope,omitempty"`
}

// RestConnectorConfig is the resolved configuration for a REST connector.
type RestConnectorConfig struct {
	ConnectorID uuid.UUID
	Name        string
	BaseURL     string
	Auth        RestAuthConfig
}

// RestConnectorAction is a single named REST operation exposed by a connector.
type RestConnectorAction struct {
	ActionName string
	HTTPMethod string
	Endpoint   string
}

// RestConnectorRepository loads REST connector configuration and actions.
type RestConnectorRepository interface {
	GetConnectorConfig(ctx context.Context, tenantID, connectorID uuid.UUID) (*RestConnectorConfig, error)
	GetAction(ctx context.Context, tenantID, connectorID uuid.UUID, actionName string) (*RestConnectorAction, error)
}

type restConnectorRow struct {
	ID                 uuid.UUID `gorm:"column:id"`
	Name               string    `gorm:"column:name"`
	BaseURL            string    `gorm:"column:base_url"`
	AuthenticationType string    `gorm:"column:authentication_type"`
	AuthConfig         []byte    `gorm:"column:auth_config"`
}

func (restConnectorRow) TableName() string { return "connectors" }

type restConnectorActionRow struct {
	ActionName string `gorm:"column:action_name"`
	HTTPMethod string `gorm:"column:http_method"`
	Endpoint   string `gorm:"column:endpoint"`
}

func (restConnectorActionRow) TableName() string { return "connector_actions" }

type secretRow struct {
	ID         uuid.UUID `gorm:"column:id"`
	Ciphertext []byte    `gorm:"column:ciphertext"`
	Nonce      []byte    `gorm:"column:nonce"`
}

func (secretRow) TableName() string { return "secrets" }

// PostgresRestConnectorRepository resolves REST connector metadata from the
// shared PostgreSQL tables owned by the metadata service (connectors,
// connector_actions). Kept inside the runtime service per architecture
// constraints - no HTTP calls to services/connector.
type PostgresRestConnectorRepository struct {
	db        *gorm.DB
	masterKey []byte
}

func NewPostgresRestConnectorRepository(db *gorm.DB) *PostgresRestConnectorRepository {
	key, err := secrets.LoadMasterKey(true)
	if err != nil {
		log.Printf("databinding: secrets master key unavailable: %v", err)
	}
	return &PostgresRestConnectorRepository{db: db, masterKey: key}
}

func (r *PostgresRestConnectorRepository) GetConnectorConfig(ctx context.Context, tenantID, connectorID uuid.UUID) (*RestConnectorConfig, error) {
	var row restConnectorRow
	err := r.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ? AND connector_type = 'rest' AND deleted_at IS NULL", connectorID, tenantID).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrDataSourceNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("databinding: load connector config: %w", err)
	}

	auth := RestAuthConfig{Type: "none"}
	if len(row.AuthConfig) > 0 {
		if err := json.Unmarshal(row.AuthConfig, &auth); err != nil {
			return nil, fmt.Errorf("databinding: parse connector auth_config: %w", err)
		}
	}
	if auth.Type == "" {
		if row.AuthenticationType != "" {
			auth.Type = row.AuthenticationType
		} else {
			auth.Type = "none"
		}
	}

	if err := r.resolveAuthSecret(ctx, tenantID, &auth); err != nil {
		return nil, err
	}

	return &RestConnectorConfig{
		ConnectorID: row.ID,
		Name:        row.Name,
		BaseURL:     row.BaseURL,
		Auth:        auth,
	}, nil
}

func (r *PostgresRestConnectorRepository) resolveAuthSecret(ctx context.Context, tenantID uuid.UUID, auth *RestAuthConfig) error {
	if auth == nil {
		return nil
	}
	isHeader := strings.EqualFold(auth.Type, "header")
	isOAuth := strings.EqualFold(auth.Type, "oauth_client_credentials")
	if !isHeader && !isOAuth {
		return nil
	}
	if auth.SecretID != "" {
		secretUUID, err := uuid.Parse(auth.SecretID)
		if err != nil {
			return fmt.Errorf("databinding: invalid secret_id: %w", err)
		}
		if len(r.masterKey) == 0 {
			return fmt.Errorf("databinding: secrets master key is not configured")
		}
		var sec secretRow
		err = r.db.WithContext(ctx).
			Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", secretUUID, tenantID).
			First(&sec).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("databinding: connector secret not found")
		}
		if err != nil {
			return fmt.Errorf("databinding: load connector secret: %w", err)
		}
		plain, err := secrets.Decrypt(r.masterKey, sec.Ciphertext, sec.Nonce)
		if err != nil {
			return fmt.Errorf("databinding: decrypt connector secret: %w", err)
		}
		if isOAuth {
			auth.ClientSecret = string(plain)
		} else {
			auth.HeaderValue = string(plain)
		}
		return nil
	}
	if isHeader && auth.HeaderValue != "" {
		legacyHeaderValueOnce.Do(func() {
			log.Printf("databinding: connector using legacy auth_config.header_value; migrate to secret_id")
		})
	}
	return nil
}

func (r *PostgresRestConnectorRepository) GetAction(ctx context.Context, tenantID, connectorID uuid.UUID, actionName string) (*RestConnectorAction, error) {
	var row restConnectorActionRow
	err := r.db.WithContext(ctx).
		Where("connector_id = ? AND tenant_id = ? AND action_name = ?", connectorID, tenantID, actionName).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrRestActionNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("databinding: load connector action: %w", err)
	}
	return &RestConnectorAction{
		ActionName: row.ActionName,
		HTTPMethod: row.HTTPMethod,
		Endpoint:   row.Endpoint,
	}, nil
}
