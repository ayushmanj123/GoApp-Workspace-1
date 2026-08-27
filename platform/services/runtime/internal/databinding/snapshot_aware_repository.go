package databinding

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

// SnapshotAwareRestConnectorRepository resolves REST connector config from the
// frozen publish snapshot when the session channel is "published" and the
// connector is present in that snapshot; otherwise it falls back to the live
// PostgresRestConnectorRepository (used for the draft channel and for
// connectors created after the last publish). See Phase 7.13.
type SnapshotAwareRestConnectorRepository struct {
	live     *PostgresRestConnectorRepository
	snapshot *SnapshotConnectorSource
}

func NewSnapshotAwareRestConnectorRepository(live *PostgresRestConnectorRepository, snapshot *SnapshotConnectorSource) *SnapshotAwareRestConnectorRepository {
	return &SnapshotAwareRestConnectorRepository{live: live, snapshot: snapshot}
}

func (r *SnapshotAwareRestConnectorRepository) GetConnectorConfig(ctx context.Context, tenantID, connectorID uuid.UUID, environmentID *uuid.UUID, userID uuid.UUID) (*RestConnectorConfig, error) {
	if IsPublishedChannel(ctx) {
		if sc, err := r.snapshot.ByID(ctx, tenantID, connectorID, environmentID); err == nil && strings.EqualFold(sc.ConnectorType, "rest") {
			return r.fromSnapshot(ctx, tenantID, sc, environmentID, userID)
		}
	}
	return r.live.GetConnectorConfig(ctx, tenantID, connectorID, environmentID, userID)
}

func (r *SnapshotAwareRestConnectorRepository) GetAction(ctx context.Context, tenantID, connectorID uuid.UUID, actionName string) (*RestConnectorAction, error) {
	if IsPublishedChannel(ctx) {
		if sc, err := r.snapshot.ByID(ctx, tenantID, connectorID, EnvironmentIDFromContext(ctx)); err == nil && strings.EqualFold(sc.ConnectorType, "rest") {
			for _, a := range sc.Actions {
				if strings.EqualFold(a.ActionName, actionName) {
					return &RestConnectorAction{ActionName: a.ActionName, HTTPMethod: a.HTTPMethod, Endpoint: a.Endpoint}, nil
				}
			}
			return nil, ErrRestActionNotFound
		}
	}
	return r.live.GetAction(ctx, tenantID, connectorID, actionName)
}

func (r *SnapshotAwareRestConnectorRepository) fromSnapshot(ctx context.Context, tenantID uuid.UUID, sc *SnapshotConnector, environmentID *uuid.UUID, userID uuid.UUID) (*RestConnectorConfig, error) {
	auth := RestAuthConfig{Type: sc.AuthenticationType}
	if len(sc.AuthConfig) > 0 {
		if err := json.Unmarshal(sc.AuthConfig, &auth); err != nil {
			return nil, fmt.Errorf("databinding: parse snapshot connector auth_config: %w", err)
		}
	}
	if auth.Type == "" {
		auth.Type = "none"
	}
	if err := r.live.resolveAuthSecret(ctx, tenantID, sc.ID, environmentID, userID, &auth); err != nil {
		return nil, err
	}
	return &RestConnectorConfig{ConnectorID: sc.ID, Name: sc.Name, BaseURL: sc.BaseURL, Auth: auth}, nil
}

// SnapshotAwareSqlConnectorRepository is the SQL connector analogue of
// SnapshotAwareRestConnectorRepository.
type SnapshotAwareSqlConnectorRepository struct {
	live     *PostgresSqlConnectorRepository
	snapshot *SnapshotConnectorSource
}

func NewSnapshotAwareSqlConnectorRepository(live *PostgresSqlConnectorRepository, snapshot *SnapshotConnectorSource) *SnapshotAwareSqlConnectorRepository {
	return &SnapshotAwareSqlConnectorRepository{live: live, snapshot: snapshot}
}

func (r *SnapshotAwareSqlConnectorRepository) GetConnectorConfig(ctx context.Context, tenantID, connectorID uuid.UUID, environmentID *uuid.UUID) (*SqlConnectorConfig, error) {
	if IsPublishedChannel(ctx) {
		if sc, err := r.snapshot.ByID(ctx, tenantID, connectorID, environmentID); err == nil && strings.EqualFold(sc.ConnectorType, "sql") {
			return r.fromSnapshot(ctx, tenantID, sc, environmentID)
		}
	}
	return r.live.GetConnectorConfig(ctx, tenantID, connectorID, environmentID)
}

func (r *SnapshotAwareSqlConnectorRepository) GetAction(ctx context.Context, tenantID, connectorID uuid.UUID, actionName string) (*SqlConnectorAction, error) {
	if IsPublishedChannel(ctx) {
		if sc, err := r.snapshot.ByID(ctx, tenantID, connectorID, EnvironmentIDFromContext(ctx)); err == nil && strings.EqualFold(sc.ConnectorType, "sql") {
			for _, a := range sc.Actions {
				if strings.EqualFold(a.ActionName, actionName) {
					return &SqlConnectorAction{ActionName: a.ActionName, HTTPMethod: a.HTTPMethod, Endpoint: a.Endpoint}, nil
				}
			}
			return nil, ErrRestActionNotFound
		}
	}
	return r.live.GetAction(ctx, tenantID, connectorID, actionName)
}

func (r *SnapshotAwareSqlConnectorRepository) fromSnapshot(ctx context.Context, tenantID uuid.UUID, sc *SnapshotConnector, environmentID *uuid.UUID) (*SqlConnectorConfig, error) {
	var auth sqlAuthConfig
	if len(sc.AuthConfig) > 0 {
		if err := json.Unmarshal(sc.AuthConfig, &auth); err != nil {
			return nil, fmt.Errorf("databinding: parse snapshot connector auth_config: %w", err)
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
		secretUUID, err := uuid.Parse(auth.SecretID)
		if err != nil {
			return nil, fmt.Errorf("databinding: invalid secret_id: %w", err)
		}
		plain, err := decryptSecretPlaintext(ctx, r.live.db, r.live.masterKey, tenantID, secretUUID, environmentID)
		if err != nil {
			return nil, err
		}
		dsn = plain
	}
	if dsn == "" {
		return nil, fmt.Errorf("databinding: sql connector has no connection string")
	}
	return &SqlConnectorConfig{
		ConnectorID:      sc.ID,
		Name:             sc.Name,
		ConnectionString: dsn,
		Table:            strings.TrimSpace(auth.Table),
		PrimaryKey:       strings.TrimSpace(auth.PrimaryKey),
	}, nil
}

// SnapshotAwareStorageConnectorRepository is the storage connector analogue
// of SnapshotAwareRestConnectorRepository.
type SnapshotAwareStorageConnectorRepository struct {
	live     *PostgresStorageConnectorRepository
	snapshot *SnapshotConnectorSource
}

func NewSnapshotAwareStorageConnectorRepository(live *PostgresStorageConnectorRepository, snapshot *SnapshotConnectorSource) *SnapshotAwareStorageConnectorRepository {
	return &SnapshotAwareStorageConnectorRepository{live: live, snapshot: snapshot}
}

func (r *SnapshotAwareStorageConnectorRepository) GetConnectorConfig(ctx context.Context, tenantID, connectorID uuid.UUID, environmentID *uuid.UUID) (*StorageConnectorConfig, error) {
	if IsPublishedChannel(ctx) {
		if sc, err := r.snapshot.ByID(ctx, tenantID, connectorID, environmentID); err == nil && strings.EqualFold(sc.ConnectorType, "storage") {
			return r.fromSnapshot(ctx, tenantID, sc, environmentID)
		}
	}
	return r.live.GetConnectorConfig(ctx, tenantID, connectorID, environmentID)
}

func (r *SnapshotAwareStorageConnectorRepository) fromSnapshot(ctx context.Context, tenantID uuid.UUID, sc *SnapshotConnector, environmentID *uuid.UUID) (*StorageConnectorConfig, error) {
	var auth storageAuthConfig
	if len(sc.AuthConfig) > 0 {
		if err := json.Unmarshal(sc.AuthConfig, &auth); err != nil {
			return nil, fmt.Errorf("databinding: parse snapshot connector auth_config: %w", err)
		}
	}
	secretKey := strings.TrimSpace(auth.SecretAccessKey)
	if auth.SecretID != "" {
		secretUUID, err := uuid.Parse(auth.SecretID)
		if err != nil {
			return nil, fmt.Errorf("databinding: invalid secret_id: %w", err)
		}
		plain, err := decryptSecretPlaintext(ctx, r.live.db, r.live.masterKey, tenantID, secretUUID, environmentID)
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
		ConnectorID: sc.ID,
		Name:        sc.Name,
		Endpoint:    strings.TrimSpace(auth.Endpoint),
		Bucket:      strings.TrimSpace(auth.Bucket),
		AccessKeyID: strings.TrimSpace(auth.AccessKeyID),
		SecretKey:   secretKey,
		UseSSL:      useSSL,
		Prefix:      strings.TrimSpace(auth.Prefix),
	}, nil
}

// SnapshotAwareGoogleSheetsConnectorRepository resolves google_sheets connector
// config from the frozen publish snapshot when applicable.
type SnapshotAwareGoogleSheetsConnectorRepository struct {
	live     *PostgresGoogleSheetsConnectorRepository
	snapshot *SnapshotConnectorSource
}

func NewSnapshotAwareGoogleSheetsConnectorRepository(live *PostgresGoogleSheetsConnectorRepository, snapshot *SnapshotConnectorSource) *SnapshotAwareGoogleSheetsConnectorRepository {
	return &SnapshotAwareGoogleSheetsConnectorRepository{live: live, snapshot: snapshot}
}

func (r *SnapshotAwareGoogleSheetsConnectorRepository) GetConnectorConfig(ctx context.Context, tenantID, connectorID uuid.UUID, environmentID *uuid.UUID, userID uuid.UUID) (*GoogleSheetsConnectorConfig, error) {
	if IsPublishedChannel(ctx) {
		if sc, err := r.snapshot.ByID(ctx, tenantID, connectorID, environmentID); err == nil && strings.EqualFold(sc.ConnectorType, "google_sheets") {
			return r.fromSnapshot(ctx, tenantID, sc, environmentID, userID)
		}
	}
	return r.live.GetConnectorConfig(ctx, tenantID, connectorID, environmentID, userID)
}

func (r *SnapshotAwareGoogleSheetsConnectorRepository) fromSnapshot(ctx context.Context, tenantID uuid.UUID, sc *SnapshotConnector, environmentID *uuid.UUID, userID uuid.UUID) (*GoogleSheetsConnectorConfig, error) {
	var raw googleSheetsAuthConfig
	if len(sc.AuthConfig) > 0 {
		if err := json.Unmarshal(sc.AuthConfig, &raw); err != nil {
			return nil, fmt.Errorf("databinding: parse snapshot google sheets auth_config: %w", err)
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
		auth.Type = sc.AuthenticationType
	}
	restRepo := &PostgresRestConnectorRepository{db: r.live.db, masterKey: r.live.masterKey}
	if err := restRepo.resolveAuthSecret(ctx, tenantID, sc.ID, environmentID, userID, &auth); err != nil {
		return nil, err
	}
	headerRow := raw.HeaderRow
	if headerRow <= 0 {
		headerRow = 1
	}
	return &GoogleSheetsConnectorConfig{
		ConnectorID:   sc.ID,
		Name:          sc.Name,
		SpreadsheetID: strings.TrimSpace(raw.SpreadsheetID),
		SheetName:     strings.TrimSpace(raw.SheetName),
		HeaderRow:     headerRow,
		KeyColumn:     strings.TrimSpace(raw.KeyColumn),
		Auth:          auth,
	}, nil
}
