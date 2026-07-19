package databinding

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ErrSnapshotNotFound is returned when no published snapshot (or no matching
// connector inside it) is available for an app/environment.
var ErrSnapshotNotFound = errors.New("databinding: published snapshot not found")

// SnapshotConnector is the frozen connector shape stored inside a published
// application snapshot (application_snapshots.snapshot_json -> connectors).
// It mirrors contracts.RuntimeConnector in services/metadata; duplicated
// here (rather than imported) because services/runtime and services/metadata
// are separate Go modules and this service never calls metadata over HTTP.
type SnapshotConnector struct {
	ID                 uuid.UUID                 `json:"id"`
	Name               string                    `json:"name"`
	ConnectorType      string                    `json:"connector_type"`
	AuthenticationType string                    `json:"authentication_type"`
	BaseURL            string                    `json:"base_url,omitempty"`
	AuthConfig         json.RawMessage           `json:"auth_config,omitempty"`
	Actions            []SnapshotConnectorAction `json:"actions,omitempty"`
}

// SnapshotConnectorAction is the frozen action shape inside a snapshot connector.
type SnapshotConnectorAction struct {
	ActionName string `json:"action_name"`
	HTTPMethod string `json:"http_method"`
	Endpoint   string `json:"endpoint"`
}

type snapshotPackage struct {
	Connectors []SnapshotConnector `json:"connectors"`
}

type snapshotJSONRow struct {
	SnapshotJSON []byte `gorm:"column:snapshot_json"`
}

func (snapshotJSONRow) TableName() string { return "application_snapshots" }

type appCurrentVersionRow struct {
	CurrentVersionID *uuid.UUID `gorm:"column:current_version_id"`
}

func (appCurrentVersionRow) TableName() string { return "applications" }

type envCurrentVersionRow struct {
	CurrentVersionID *uuid.UUID `gorm:"column:current_version_id"`
}

func (envCurrentVersionRow) TableName() string { return "environments" }

type connectorAppRow struct {
	ApplicationID uuid.UUID `gorm:"column:application_id"`
}

func (connectorAppRow) TableName() string { return "connectors" }

// SnapshotConnectorSource loads frozen connector configuration from the most
// recent published application snapshot (or an environment's promoted
// snapshot). This is what lets the published/environmentId runtime channel
// keep serving connector config exactly as it was at publish time, even
// after the live connector row is edited in Studio (Phase 7.13).
type SnapshotConnectorSource struct {
	db *gorm.DB
}

func NewSnapshotConnectorSource(db *gorm.DB) *SnapshotConnectorSource {
	return &SnapshotConnectorSource{db: db}
}

// ByID returns the frozen connector snapshot for connectorID. appID is
// resolved from the (possibly soft-deleted) connectors row so a connector
// removed after publish can still be served from the frozen snapshot.
func (s *SnapshotConnectorSource) ByID(ctx context.Context, tenantID, connectorID uuid.UUID, environmentID *uuid.UUID) (*SnapshotConnector, error) {
	appID, err := s.appIDForConnector(ctx, tenantID, connectorID)
	if err != nil {
		return nil, err
	}
	pkg, err := s.loadPackage(ctx, tenantID, appID, environmentID)
	if err != nil {
		return nil, err
	}
	for i := range pkg.Connectors {
		if pkg.Connectors[i].ID == connectorID {
			return &pkg.Connectors[i], nil
		}
	}
	return nil, ErrSnapshotNotFound
}

// ByNameInApp returns the frozen connector snapshot by connector name,
// scoped to a known application id (used by entity/name resolution).
func (s *SnapshotConnectorSource) ByNameInApp(ctx context.Context, tenantID, appID uuid.UUID, name string, environmentID *uuid.UUID) (*SnapshotConnector, error) {
	pkg, err := s.loadPackage(ctx, tenantID, appID, environmentID)
	if err != nil {
		return nil, err
	}
	for i := range pkg.Connectors {
		if strings.EqualFold(pkg.Connectors[i].Name, name) {
			return &pkg.Connectors[i], nil
		}
	}
	return nil, ErrSnapshotNotFound
}

func (s *SnapshotConnectorSource) appIDForConnector(ctx context.Context, tenantID, connectorID uuid.UUID) (uuid.UUID, error) {
	if s == nil || s.db == nil {
		return uuid.Nil, ErrSnapshotNotFound
	}
	var row connectorAppRow
	err := s.db.WithContext(ctx).
		Unscoped().
		Select("application_id").
		Where("id = ? AND tenant_id = ?", connectorID, tenantID).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return uuid.Nil, ErrSnapshotNotFound
	}
	if err != nil {
		return uuid.Nil, fmt.Errorf("databinding: load connector application: %w", err)
	}
	return row.ApplicationID, nil
}

func (s *SnapshotConnectorSource) loadPackage(ctx context.Context, tenantID, appID uuid.UUID, environmentID *uuid.UUID) (*snapshotPackage, error) {
	if s == nil || s.db == nil {
		return nil, ErrSnapshotNotFound
	}
	versionID, err := s.currentVersionID(ctx, tenantID, appID, environmentID)
	if err != nil {
		return nil, err
	}
	if versionID == nil || *versionID == uuid.Nil {
		return nil, ErrSnapshotNotFound
	}

	var row snapshotJSONRow
	err = s.db.WithContext(ctx).
		Where("tenant_id = ? AND application_version_id = ?", tenantID, *versionID).
		Order("created_on DESC").
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrSnapshotNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("databinding: load published snapshot: %w", err)
	}

	var pkg snapshotPackage
	if err := json.Unmarshal(row.SnapshotJSON, &pkg); err != nil {
		return nil, fmt.Errorf("databinding: decode published snapshot: %w", err)
	}
	return &pkg, nil
}

func (s *SnapshotConnectorSource) currentVersionID(ctx context.Context, tenantID, appID uuid.UUID, environmentID *uuid.UUID) (*uuid.UUID, error) {
	if environmentID != nil && *environmentID != uuid.Nil {
		var env envCurrentVersionRow
		err := s.db.WithContext(ctx).
			Where("id = ? AND tenant_id = ?", *environmentID, tenantID).
			First(&env).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrSnapshotNotFound
		}
		if err != nil {
			return nil, fmt.Errorf("databinding: load environment: %w", err)
		}
		return env.CurrentVersionID, nil
	}

	var app appCurrentVersionRow
	err := s.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ?", appID, tenantID).
		First(&app).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrSnapshotNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("databinding: load application: %w", err)
	}
	return app.CurrentVersionID, nil
}
