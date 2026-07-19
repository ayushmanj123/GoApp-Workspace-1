package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/shared/secrets"
	"github.com/google/uuid"
)

// EnvironmentSecretOverrideView is the API-safe override row (no ciphertext).
type EnvironmentSecretOverrideView struct {
	ID            uuid.UUID `json:"id"`
	EnvironmentID uuid.UUID `json:"environment_id"`
	ConnectorID   uuid.UUID `json:"connector_id"`
	BaseSecretID  uuid.UUID `json:"base_secret_id"`
	HasOverride   bool      `json:"has_override"`
}

// EnvironmentSecretService manages per-environment secret overrides for connectors.
type EnvironmentSecretService struct {
	store     repositories.Store
	masterKey []byte
}

func NewEnvironmentSecretService(store repositories.Store) *EnvironmentSecretService {
	key, _ := secrets.LoadMasterKey(true)
	return &EnvironmentSecretService{store: store, masterKey: key}
}

func (s *EnvironmentSecretService) ListForEnvironment(ctx context.Context, tenantID, appID, envID uuid.UUID) ([]EnvironmentSecretOverrideView, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	if _, err := sess.Environments().GetByID(ctx, envID); err != nil {
		return nil, fmt.Errorf("environment not found: %w", err)
	}
	connectors, err := listConnectorsByApp(ctx, sess, tenantID, appID)
	if err != nil {
		return nil, err
	}
	overrides, err := listEnvSecretOverrides(ctx, sess, envID)
	if err != nil {
		return nil, err
	}
	bySecret := map[uuid.UUID]models.EnvironmentSecretOverride{}
	for _, o := range overrides {
		bySecret[o.BaseSecretID] = o
	}

	out := make([]EnvironmentSecretOverrideView, 0)
	for _, c := range connectors {
		baseID, ok := secretIDFromAuthConfig(c.AuthConfig)
		if !ok {
			continue
		}
		view := EnvironmentSecretOverrideView{
			EnvironmentID: envID,
			ConnectorID:   c.ID,
			BaseSecretID:  baseID,
		}
		if o, ok := bySecret[baseID]; ok {
			view.ID = o.ID
			view.HasOverride = true
		}
		out = append(out, view)
	}
	return out, nil
}

func (s *EnvironmentSecretService) Upsert(ctx context.Context, tenantID, appID, envID, connectorID uuid.UUID, plaintext string) (*EnvironmentSecretOverrideView, error) {
	plaintext = strings.TrimSpace(plaintext)
	if plaintext == "" {
		return nil, fmt.Errorf("secret value is required")
	}
	if len(s.masterKey) == 0 {
		return nil, fmt.Errorf("secrets master key is not configured")
	}
	sess := s.store.WithTenant(ctx, tenantID)
	env, err := sess.Environments().GetByID(ctx, envID)
	if err != nil {
		return nil, fmt.Errorf("environment not found: %w", err)
	}
	if env.ApplicationID != appID {
		return nil, ErrEnvironmentNotFound
	}
	conn, err := sess.Connectors().GetByID(ctx, connectorID)
	if err != nil {
		return nil, fmt.Errorf("connector not found: %w", err)
	}
	if conn.ApplicationID != appID {
		return nil, fmt.Errorf("connector does not belong to application")
	}
	baseID, ok := secretIDFromAuthConfig(conn.AuthConfig)
	if !ok {
		return nil, fmt.Errorf("connector has no secret_id to override")
	}

	ct, nonce, err := secrets.Encrypt(s.masterKey, []byte(plaintext))
	if err != nil {
		return nil, err
	}

	existing, _ := listEnvSecretOverrides(ctx, sess, envID)
	var found *models.EnvironmentSecretOverride
	for i := range existing {
		if existing[i].BaseSecretID == baseID {
			found = &existing[i]
			break
		}
	}
	if found != nil {
		found.Ciphertext = ct
		found.Nonce = nonce
		if err := sess.EnvironmentSecretOverrides().Update(ctx, found); err != nil {
			return nil, err
		}
		return &EnvironmentSecretOverrideView{
			ID:            found.ID,
			EnvironmentID: envID,
			ConnectorID:   connectorID,
			BaseSecretID:  baseID,
			HasOverride:   true,
		}, nil
	}

	row := &models.EnvironmentSecretOverride{
		ID:            uuid.New(),
		TenantID:      tenantID,
		EnvironmentID: envID,
		BaseSecretID:  baseID,
		Ciphertext:    ct,
		Nonce:         nonce,
	}
	if err := sess.EnvironmentSecretOverrides().Create(ctx, row); err != nil {
		return nil, err
	}
	return &EnvironmentSecretOverrideView{
		ID:            row.ID,
		EnvironmentID: envID,
		ConnectorID:   connectorID,
		BaseSecretID:  baseID,
		HasOverride:   true,
	}, nil
}

func (s *EnvironmentSecretService) Delete(ctx context.Context, tenantID, appID, envID, connectorID uuid.UUID) error {
	sess := s.store.WithTenant(ctx, tenantID)
	env, err := sess.Environments().GetByID(ctx, envID)
	if err != nil {
		return fmt.Errorf("environment not found: %w", err)
	}
	if env.ApplicationID != appID {
		return ErrEnvironmentNotFound
	}
	conn, err := sess.Connectors().GetByID(ctx, connectorID)
	if err != nil {
		return fmt.Errorf("connector not found: %w", err)
	}
	baseID, ok := secretIDFromAuthConfig(conn.AuthConfig)
	if !ok {
		return nil
	}
	existing, _ := listEnvSecretOverrides(ctx, sess, envID)
	for _, o := range existing {
		if o.BaseSecretID == baseID {
			return sess.EnvironmentSecretOverrides().Delete(ctx, o.ID)
		}
	}
	return nil
}

func listConnectorsByApp(ctx context.Context, sess repositories.TenantSession, tenantID, appID uuid.UUID) ([]models.Connector, error) {
	if repo, ok := any(sess.Connectors()).(byFieldRepo[models.Connector]); ok {
		return repo.ListByField(ctx, "application_id", appID, 500, 0)
	}
	items, err := sess.Connectors().ListByTenant(ctx, tenantID, 500, 0)
	if err != nil {
		return nil, err
	}
	var out []models.Connector
	for _, c := range items {
		if c.ApplicationID == appID {
			out = append(out, c)
		}
	}
	return out, nil
}

func listEnvSecretOverrides(ctx context.Context, sess repositories.TenantSession, envID uuid.UUID) ([]models.EnvironmentSecretOverride, error) {
	if repo, ok := any(sess.EnvironmentSecretOverrides()).(byFieldRepo[models.EnvironmentSecretOverride]); ok {
		return repo.ListByField(ctx, "environment_id", envID, 500, 0)
	}
	return nil, nil
}

func secretIDFromAuthConfig(raw []byte) (uuid.UUID, bool) {
	var cfg struct {
		SecretID string `json:"secret_id"`
	}
	if len(raw) == 0 {
		return uuid.Nil, false
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return uuid.Nil, false
	}
	id, err := uuid.Parse(strings.TrimSpace(cfg.SecretID))
	if err != nil {
		return uuid.Nil, false
	}
	return id, true
}
