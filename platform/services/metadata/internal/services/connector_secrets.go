package services

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/shared/secrets"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// ConnectorResponse is the API-safe connector view (never includes secret plaintext).
type ConnectorResponse struct {
	ID                 uuid.UUID       `json:"id"`
	TenantID           uuid.UUID       `json:"tenant_id"`
	ApplicationID      uuid.UUID       `json:"application_id"`
	ConnectorType      string          `json:"connector_type"`
	Name               string          `json:"name"`
	AuthenticationType string          `json:"authentication_type"`
	BaseURL            string          `json:"base_url"`
	AuthConfig         json.RawMessage `json:"auth_config"`
	HasSecret          bool            `json:"has_secret"`
	HasConnection      bool            `json:"has_connection"`
	CreatedOn          time.Time       `json:"created_on"`
	ModifiedOn         time.Time       `json:"modified_on"`
}

type connectorAuthConfig struct {
	Type              string `json:"type"`
	HeaderName        string `json:"header_name,omitempty"`
	HeaderValue       string `json:"header_value,omitempty"`
	ConnectionString  string `json:"connection_string,omitempty"`
	ClientSecret      string `json:"client_secret,omitempty"`
	SecretAccessKey   string `json:"secret_access_key,omitempty"`
	SecretID          string `json:"secret_id,omitempty"`
	RefreshSecretID   string `json:"refresh_secret_id,omitempty"`
	Table             string `json:"table,omitempty"`
	PrimaryKey        string `json:"primary_key,omitempty"`
	TokenURL          string `json:"token_url,omitempty"`
	AuthorizationURL  string `json:"authorization_url,omitempty"`
	ClientID          string `json:"client_id,omitempty"`
	Scope             string `json:"scope,omitempty"`
	ConnectionScope   string `json:"connection_scope,omitempty"`
	Endpoint          string `json:"endpoint,omitempty"`
	Bucket            string `json:"bucket,omitempty"`
	AccessKeyID       string `json:"access_key_id,omitempty"`
	UseSSL            *bool  `json:"use_ssl,omitempty"`
	Prefix            string `json:"prefix,omitempty"`
	SpreadsheetID     string `json:"spreadsheet_id,omitempty"`
	SheetName         string `json:"sheet_name,omitempty"`
	HeaderRow         int    `json:"header_row,omitempty"`
	KeyColumn         string `json:"key_column,omitempty"`
}

var sqlIdentifierPart = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

// ValidateSQLTableName allows empty (named-query connectors), "table", or "schema.table".
func ValidateSQLTableName(table string) error {
	table = strings.TrimSpace(table)
	if table == "" {
		return nil
	}
	parts := strings.Split(table, ".")
	if len(parts) > 2 {
		return fmt.Errorf("auth_config.table must be table or schema.table")
	}
	for _, part := range parts {
		if !sqlIdentifierPart.MatchString(part) {
			return fmt.Errorf("auth_config.table contains an invalid identifier")
		}
	}
	return nil
}

// ValidateSQLPrimaryKey allows empty or a single safe identifier.
func ValidateSQLPrimaryKey(pk string) error {
	pk = strings.TrimSpace(pk)
	if pk == "" {
		return nil
	}
	if !sqlIdentifierPart.MatchString(pk) {
		return fmt.Errorf("auth_config.primary_key contains an invalid identifier")
	}
	return nil
}

func toConnectorResponse(c *models.Connector) ConnectorResponse {
	authJSON, hasSecret := redactAuthConfig(c.AuthConfig)
	hasConnection := false
	if cfg, err := parseAuthConfig(c.AuthConfig); err == nil {
		hasConnection = strings.TrimSpace(cfg.RefreshSecretID) != ""
	}
	return ConnectorResponse{
		ID:                 c.ID,
		TenantID:           c.TenantID,
		ApplicationID:      c.ApplicationID,
		ConnectorType:      c.ConnectorType,
		Name:               c.Name,
		AuthenticationType: c.AuthenticationType,
		BaseURL:            c.BaseURL,
		AuthConfig:         authJSON,
		HasSecret:          hasSecret,
		HasConnection:      hasConnection,
		CreatedOn:          c.CreatedOn,
		ModifiedOn:         c.ModifiedOn,
	}
}

func toConnectorResponses(items []models.Connector) []ConnectorResponse {
	out := make([]ConnectorResponse, 0, len(items))
	for i := range items {
		out = append(out, toConnectorResponse(&items[i]))
	}
	return out
}

func redactAuthConfig(raw datatypes.JSON) (json.RawMessage, bool) {
	if len(raw) == 0 {
		return json.RawMessage(`{}`), false
	}
	var cfg connectorAuthConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return json.RawMessage(raw), false
	}
	hasSecret := strings.TrimSpace(cfg.SecretID) != "" ||
		strings.TrimSpace(cfg.RefreshSecretID) != "" ||
		strings.TrimSpace(cfg.HeaderValue) != "" ||
		strings.TrimSpace(cfg.ConnectionString) != "" ||
		strings.TrimSpace(cfg.ClientSecret) != "" ||
		strings.TrimSpace(cfg.SecretAccessKey) != ""
	cfg.HeaderValue = ""
	cfg.ConnectionString = ""
	cfg.ClientSecret = ""
	cfg.SecretAccessKey = ""
	out, err := json.Marshal(cfg)
	if err != nil {
		return json.RawMessage(`{}`), hasSecret
	}
	return out, hasSecret
}

func parseAuthConfig(raw []byte) (connectorAuthConfig, error) {
	var cfg connectorAuthConfig
	if len(raw) == 0 {
		return cfg, nil
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return cfg, fmt.Errorf("invalid auth_config: %w", err)
	}
	return cfg, nil
}

func (s *ConnectorService) persistAuthConfig(
	ctx context.Context,
	sess repositories.TenantSession,
	tenantID, appID uuid.UUID,
	connectorName, authenticationType string,
	raw []byte,
	existing datatypes.JSON,
) (datatypes.JSON, error) {
	cfg, err := parseAuthConfig(raw)
	if err != nil {
		return nil, err
	}
	if authenticationType == "" {
		authenticationType = cfg.Type
	}
	if cfg.Type == "" {
		cfg.Type = authenticationType
	}

	existingCfg, _ := parseAuthConfig(existing)
	headerValue := strings.TrimSpace(cfg.HeaderValue)
	connectionString := strings.TrimSpace(cfg.ConnectionString)
	clientSecret := strings.TrimSpace(cfg.ClientSecret)
	secretAccessKey := strings.TrimSpace(cfg.SecretAccessKey)
	cfg.HeaderValue = ""
	cfg.ConnectionString = ""
	cfg.ClientSecret = ""
	cfg.SecretAccessKey = ""

	switch {
	case strings.EqualFold(authenticationType, "connection_string") || strings.EqualFold(cfg.Type, "connection_string"):
		cfg.Type = "connection_string"
		cfg.HeaderName = ""
		cfg.TokenURL = ""
		cfg.ClientID = ""
		cfg.Scope = ""
		cfg.Endpoint = ""
		cfg.Bucket = ""
		cfg.AccessKeyID = ""
		cfg.UseSSL = nil
		cfg.Prefix = ""
		if cfg.Table == "" {
			cfg.Table = existingCfg.Table
		}
		if cfg.PrimaryKey == "" {
			cfg.PrimaryKey = existingCfg.PrimaryKey
		}
		if err := ValidateSQLTableName(cfg.Table); err != nil {
			return nil, err
		}
		if err := ValidateSQLPrimaryKey(cfg.PrimaryKey); err != nil {
			return nil, err
		}
		if connectionString != "" {
			secretID, err := s.upsertNamedSecret(ctx, sess, tenantID, appID, connectorName, "connection_string", connectionString, existingCfg.SecretID)
			if err != nil {
				return nil, err
			}
			cfg.SecretID = secretID
		} else if existingCfg.SecretID != "" {
			cfg.SecretID = existingCfg.SecretID
		} else if existingCfg.ConnectionString != "" {
			secretID, err := s.upsertNamedSecret(ctx, sess, tenantID, appID, connectorName, "connection_string", existingCfg.ConnectionString, "")
			if err != nil {
				return nil, err
			}
			cfg.SecretID = secretID
		} else if cfg.SecretID == "" {
			return nil, fmt.Errorf("auth_config.connection_string is required when creating a SQL connector")
		}

	case strings.EqualFold(authenticationType, "oauth_client_credentials") || strings.EqualFold(cfg.Type, "oauth_client_credentials"):
		cfg.Type = "oauth_client_credentials"
		cfg.HeaderName = ""
		cfg.Table = ""
		cfg.PrimaryKey = ""
		cfg.Endpoint = ""
		cfg.Bucket = ""
		cfg.AccessKeyID = ""
		cfg.UseSSL = nil
		cfg.Prefix = ""
		cfg.AuthorizationURL = ""
		cfg.RefreshSecretID = ""
		if cfg.TokenURL == "" {
			cfg.TokenURL = existingCfg.TokenURL
		}
		if cfg.ClientID == "" {
			cfg.ClientID = existingCfg.ClientID
		}
		if cfg.Scope == "" {
			cfg.Scope = existingCfg.Scope
		}
		if strings.TrimSpace(cfg.TokenURL) == "" {
			return nil, fmt.Errorf("auth_config.token_url is required for oauth_client_credentials")
		}
		if strings.TrimSpace(cfg.ClientID) == "" {
			return nil, fmt.Errorf("auth_config.client_id is required for oauth_client_credentials")
		}
		if clientSecret != "" {
			secretID, err := s.upsertNamedSecret(ctx, sess, tenantID, appID, connectorName, "client_secret", clientSecret, existingCfg.SecretID)
			if err != nil {
				return nil, err
			}
			cfg.SecretID = secretID
		} else if existingCfg.SecretID != "" {
			cfg.SecretID = existingCfg.SecretID
		} else if existingCfg.ClientSecret != "" {
			secretID, err := s.upsertNamedSecret(ctx, sess, tenantID, appID, connectorName, "client_secret", existingCfg.ClientSecret, "")
			if err != nil {
				return nil, err
			}
			cfg.SecretID = secretID
		} else if cfg.SecretID == "" {
			return nil, fmt.Errorf("auth_config.client_secret is required when creating an oauth connector")
		}

	case strings.EqualFold(authenticationType, "oauth_authorization_code") || strings.EqualFold(cfg.Type, "oauth_authorization_code"):
		cfg.Type = "oauth_authorization_code"
		cfg.HeaderName = ""
		cfg.Table = ""
		cfg.PrimaryKey = ""
		cfg.Endpoint = ""
		cfg.Bucket = ""
		cfg.AccessKeyID = ""
		cfg.UseSSL = nil
		cfg.Prefix = ""
		if cfg.SpreadsheetID == "" {
			cfg.SpreadsheetID = existingCfg.SpreadsheetID
		}
		if cfg.SheetName == "" {
			cfg.SheetName = existingCfg.SheetName
		}
		if cfg.HeaderRow <= 0 {
			cfg.HeaderRow = existingCfg.HeaderRow
		}
		if cfg.KeyColumn == "" {
			cfg.KeyColumn = existingCfg.KeyColumn
		}
		if cfg.AuthorizationURL == "" {
			cfg.AuthorizationURL = existingCfg.AuthorizationURL
		}
		if cfg.TokenURL == "" {
			cfg.TokenURL = existingCfg.TokenURL
		}
		if cfg.ClientID == "" {
			cfg.ClientID = existingCfg.ClientID
		}
		if cfg.Scope == "" {
			cfg.Scope = existingCfg.Scope
		}
		cfg.ConnectionScope = normalizeConnectionScope(cfg.ConnectionScope)
		if cfg.ConnectionScope == "" {
			cfg.ConnectionScope = normalizeConnectionScope(existingCfg.ConnectionScope)
		}
		if cfg.ConnectionScope == "" {
			cfg.ConnectionScope = "app"
		}
		if cfg.ConnectionScope != "app" && cfg.ConnectionScope != "user" {
			return nil, fmt.Errorf("auth_config.connection_scope must be app or user")
		}
		// App-scoped: preserve shared refresh. User-scoped: never keep connector-level refresh.
		if cfg.ConnectionScope == "app" {
			cfg.RefreshSecretID = existingCfg.RefreshSecretID
		} else {
			cfg.RefreshSecretID = ""
		}
		if strings.TrimSpace(cfg.AuthorizationURL) == "" {
			return nil, fmt.Errorf("auth_config.authorization_url is required for oauth_authorization_code")
		}
		if strings.TrimSpace(cfg.TokenURL) == "" {
			return nil, fmt.Errorf("auth_config.token_url is required for oauth_authorization_code")
		}
		if strings.TrimSpace(cfg.ClientID) == "" {
			return nil, fmt.Errorf("auth_config.client_id is required for oauth_authorization_code")
		}
		if clientSecret != "" {
			secretID, err := s.upsertNamedSecret(ctx, sess, tenantID, appID, connectorName, "client_secret", clientSecret, existingCfg.SecretID)
			if err != nil {
				return nil, err
			}
			cfg.SecretID = secretID
		} else if existingCfg.SecretID != "" {
			cfg.SecretID = existingCfg.SecretID
		} else if existingCfg.ClientSecret != "" {
			secretID, err := s.upsertNamedSecret(ctx, sess, tenantID, appID, connectorName, "client_secret", existingCfg.ClientSecret, "")
			if err != nil {
				return nil, err
			}
			cfg.SecretID = secretID
		} else if cfg.SecretID == "" {
			return nil, fmt.Errorf("auth_config.client_secret is required when creating an oauth_authorization_code connector")
		}

	case strings.EqualFold(authenticationType, "s3") || strings.EqualFold(cfg.Type, "s3"):
		cfg.Type = "s3"
		cfg.HeaderName = ""
		cfg.Table = ""
		cfg.PrimaryKey = ""
		cfg.TokenURL = ""
		cfg.ClientID = ""
		cfg.Scope = ""
		if cfg.Endpoint == "" {
			cfg.Endpoint = existingCfg.Endpoint
		}
		if cfg.Bucket == "" {
			cfg.Bucket = existingCfg.Bucket
		}
		if cfg.AccessKeyID == "" {
			cfg.AccessKeyID = existingCfg.AccessKeyID
		}
		if cfg.Prefix == "" {
			cfg.Prefix = existingCfg.Prefix
		}
		if cfg.UseSSL == nil {
			cfg.UseSSL = existingCfg.UseSSL
		}
		if strings.TrimSpace(cfg.Endpoint) == "" {
			return nil, fmt.Errorf("auth_config.endpoint is required for s3 connectors")
		}
		if strings.TrimSpace(cfg.Bucket) == "" {
			return nil, fmt.Errorf("auth_config.bucket is required for s3 connectors")
		}
		if strings.TrimSpace(cfg.AccessKeyID) == "" {
			return nil, fmt.Errorf("auth_config.access_key_id is required for s3 connectors")
		}
		if clientSecret != "" {
			secretID, err := s.upsertNamedSecret(ctx, sess, tenantID, appID, connectorName, "access_key_secret", clientSecret, existingCfg.SecretID)
			if err != nil {
				return nil, err
			}
			cfg.SecretID = secretID
		} else if secretAccessKey != "" {
			secretID, err := s.upsertNamedSecret(ctx, sess, tenantID, appID, connectorName, "access_key_secret", secretAccessKey, existingCfg.SecretID)
			if err != nil {
				return nil, err
			}
			cfg.SecretID = secretID
		} else if existingCfg.SecretID != "" {
			cfg.SecretID = existingCfg.SecretID
		} else if existingCfg.SecretAccessKey != "" {
			secretID, err := s.upsertNamedSecret(ctx, sess, tenantID, appID, connectorName, "access_key_secret", existingCfg.SecretAccessKey, "")
			if err != nil {
				return nil, err
			}
			cfg.SecretID = secretID
		} else if existingCfg.ClientSecret != "" {
			secretID, err := s.upsertNamedSecret(ctx, sess, tenantID, appID, connectorName, "access_key_secret", existingCfg.ClientSecret, "")
			if err != nil {
				return nil, err
			}
			cfg.SecretID = secretID
		} else if cfg.SecretID == "" {
			return nil, fmt.Errorf("auth_config.secret_access_key is required when creating an s3 connector")
		}

	case strings.EqualFold(authenticationType, "header") || strings.EqualFold(cfg.Type, "header"):
		cfg.Type = "header"
		cfg.Table = ""
		cfg.PrimaryKey = ""
		cfg.TokenURL = ""
		cfg.ClientID = ""
		cfg.Scope = ""
		cfg.Endpoint = ""
		cfg.Bucket = ""
		cfg.AccessKeyID = ""
		cfg.UseSSL = nil
		cfg.Prefix = ""
		if cfg.HeaderName == "" {
			cfg.HeaderName = existingCfg.HeaderName
		}
		if cfg.HeaderName == "" {
			return nil, fmt.Errorf("auth_config.header_name is required for header authentication")
		}
		if headerValue != "" {
			secretID, err := s.upsertNamedSecret(ctx, sess, tenantID, appID, connectorName, "header", headerValue, existingCfg.SecretID)
			if err != nil {
				return nil, err
			}
			cfg.SecretID = secretID
		} else if existingCfg.SecretID != "" {
			cfg.SecretID = existingCfg.SecretID
		} else if existingCfg.HeaderValue != "" {
			secretID, err := s.upsertNamedSecret(ctx, sess, tenantID, appID, connectorName, "header", existingCfg.HeaderValue, "")
			if err != nil {
				return nil, err
			}
			cfg.SecretID = secretID
		} else if cfg.SecretID == "" {
			return nil, fmt.Errorf("auth_config.header_value is required when creating a header-authenticated connector")
		}

	default:
		cfg.Type = "none"
		cfg.HeaderName = ""
		cfg.SecretID = ""
		cfg.RefreshSecretID = ""
		cfg.AuthorizationURL = ""
		cfg.TokenURL = ""
		cfg.ClientID = ""
		cfg.Scope = ""
		cfg.Table = ""
		cfg.PrimaryKey = ""
	}

	out, err := json.Marshal(cfg)
	if err != nil {
		return nil, fmt.Errorf("marshal auth_config: %w", err)
	}
	return datatypes.JSON(out), nil
}

func (s *ConnectorService) upsertNamedSecret(
	ctx context.Context,
	sess repositories.TenantSession,
	tenantID, appID uuid.UUID,
	connectorName, kind, plaintext, existingSecretID string,
) (string, error) {
	key, err := secrets.LoadMasterKeyFromEnv()
	if err != nil {
		return "", fmt.Errorf("load secrets master key: %w", err)
	}
	ciphertext, nonce, err := secrets.Encrypt(key, []byte(plaintext))
	if err != nil {
		return "", fmt.Errorf("encrypt secret: %w", err)
	}
	secretName := fmt.Sprintf("connector:%s:%s", connectorName, kind)

	if existingSecretID != "" {
		id, err := uuid.Parse(existingSecretID)
		if err == nil {
			sec, getErr := sess.Secrets().GetByID(ctx, id)
			if getErr == nil && sec != nil {
				sec.Name = secretName
				sec.Ciphertext = ciphertext
				sec.Nonce = nonce
				appCopy := appID
				sec.ApplicationID = &appCopy
				if err := sess.Secrets().Update(ctx, sec); err != nil {
					return "", fmt.Errorf("update secret: %w", err)
				}
				return sec.ID.String(), nil
			}
		}
	}

	appCopy := appID
	sec := &models.Secret{
		TenantID:      tenantID,
		ApplicationID: &appCopy,
		Name:          secretName,
		Ciphertext:    ciphertext,
		Nonce:         nonce,
	}
	if err := sess.Secrets().Create(ctx, sec); err != nil {
		return "", fmt.Errorf("create secret: %w", err)
	}
	return sec.ID.String(), nil
}

func normalizeConnectionScope(v string) string {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "user":
		return "user"
	case "app":
		return "app"
	default:
		return strings.TrimSpace(v)
	}
}
