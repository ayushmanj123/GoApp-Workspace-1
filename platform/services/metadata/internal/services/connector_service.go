package services

import (
	"context"
	"fmt"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/google/uuid"
)

var allowedConnectorTypes = map[string]struct{}{
	"rest":    {},
	"sql":     {},
	"storage": {},
}

var allowedAuthenticationTypes = map[string]struct{}{
	"none":                     {},
	"header":                   {},
	"connection_string":        {},
	"oauth_client_credentials": {},
	"oauth_authorization_code": {},
	"s3":                       {},
}

var allowedHTTPMethods = map[string]struct{}{
	"GET":     {},
	"POST":    {},
	"PUT":     {},
	"PATCH":   {},
	"DELETE":  {},
	"HEAD":    {},
	"OPTIONS": {},
}

// ConnectorService manages connectors and their actions.
type ConnectorService struct {
	store repositories.Store
}

func NewConnectorService(store repositories.Store) *ConnectorService {
	return &ConnectorService{store: store}
}

func (s *ConnectorService) Create(ctx context.Context, tenantID, appID uuid.UUID, name, connectorType, authenticationType, baseURL string, authConfig []byte) (*ConnectorResponse, error) {
	if _, ok := allowedConnectorTypes[connectorType]; !ok {
		return nil, fmt.Errorf("invalid connector_type: %s", connectorType)
	}
	if _, ok := allowedAuthenticationTypes[authenticationType]; !ok {
		return nil, fmt.Errorf("invalid authentication_type: %s", authenticationType)
	}
	if len(authConfig) == 0 {
		authConfig = []byte("{}")
	}
	sess := s.store.WithTenant(ctx, tenantID)
	persistedAuth, err := s.persistAuthConfig(ctx, sess, tenantID, appID, name, authenticationType, authConfig, nil)
	if err != nil {
		return nil, err
	}
	connector := &models.Connector{
		TenantID:           tenantID,
		ApplicationID:      appID,
		Name:               name,
		ConnectorType:      connectorType,
		AuthenticationType: authenticationType,
		BaseURL:            baseURL,
		AuthConfig:         persistedAuth,
	}
	if err := sess.Connectors().Create(ctx, connector); err != nil {
		return nil, fmt.Errorf("create connector: %w", err)
	}
	resp := toConnectorResponse(connector)
	return &resp, nil
}

func (s *ConnectorService) Update(ctx context.Context, tenantID, id uuid.UUID, updates map[string]interface{}) (*ConnectorResponse, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	connector, err := sess.Connectors().GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get connector for update: %w", err)
	}
	if v, ok := updates["name"].(string); ok {
		connector.Name = v
	}
	if v, ok := updates["authentication_type"].(string); ok {
		if _, ok := allowedAuthenticationTypes[v]; !ok {
			return nil, fmt.Errorf("invalid authentication_type: %s", v)
		}
		connector.AuthenticationType = v
	}
	if v, ok := updates["base_url"].(string); ok {
		connector.BaseURL = v
	}
	if v, ok := updates["auth_config"].([]byte); ok && len(v) > 0 {
		persistedAuth, err := s.persistAuthConfig(ctx, sess, tenantID, connector.ApplicationID, connector.Name, connector.AuthenticationType, v, connector.AuthConfig)
		if err != nil {
			return nil, err
		}
		connector.AuthConfig = persistedAuth
	}
	if err := sess.Connectors().Update(ctx, connector); err != nil {
		return nil, fmt.Errorf("update connector: %w", err)
	}
	resp := toConnectorResponse(connector)
	return &resp, nil
}

func (s *ConnectorService) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	sess := s.store.WithTenant(ctx, tenantID)
	if err := sess.Connectors().Delete(ctx, id); err != nil {
		return fmt.Errorf("delete connector: %w", err)
	}
	return nil
}

func (s *ConnectorService) ListByApplication(ctx context.Context, tenantID, appID uuid.UUID, limit, offset int) ([]ConnectorResponse, int64, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	if repo, ok := any(sess.Connectors()).(byFieldRepo[models.Connector]); ok {
		items, err := repo.ListByField(ctx, "application_id", appID, limit, offset)
		if err != nil {
			return nil, 0, fmt.Errorf("list connectors: %w", err)
		}
		return toConnectorResponses(items), int64(len(items)), nil
	}
	items, err := sess.Connectors().ListByTenant(ctx, tenantID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list connectors: %w", err)
	}
	var filtered []models.Connector
	for _, item := range items {
		if item.ApplicationID == appID {
			filtered = append(filtered, item)
		}
	}
	return toConnectorResponses(filtered), int64(len(filtered)), nil
}

func (s *ConnectorService) Get(ctx context.Context, tenantID, id uuid.UUID) (*ConnectorResponse, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	connector, err := sess.Connectors().GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get connector: %w", err)
	}
	resp := toConnectorResponse(connector)
	return &resp, nil
}

func (s *ConnectorService) CreateAction(ctx context.Context, tenantID, connectorID uuid.UUID, actionName, httpMethod, endpoint string) (*models.ConnectorAction, error) {
	if _, ok := allowedHTTPMethods[httpMethod]; !ok {
		return nil, fmt.Errorf("invalid http_method: %s", httpMethod)
	}
	action := &models.ConnectorAction{
		TenantID:    tenantID,
		ConnectorID: connectorID,
		ActionName:  actionName,
		HTTPMethod:  httpMethod,
		Endpoint:    endpoint,
	}
	sess := s.store.WithTenant(ctx, tenantID)
	if err := sess.ConnectorActions().Create(ctx, action); err != nil {
		return nil, fmt.Errorf("create connector action: %w", err)
	}
	return action, nil
}

func (s *ConnectorService) UpdateAction(ctx context.Context, tenantID, id uuid.UUID, updates map[string]interface{}) (*models.ConnectorAction, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	action, err := sess.ConnectorActions().GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get connector action for update: %w", err)
	}
	if v, ok := updates["action_name"].(string); ok {
		action.ActionName = v
	}
	if v, ok := updates["http_method"].(string); ok {
		if _, ok := allowedHTTPMethods[v]; !ok {
			return nil, fmt.Errorf("invalid http_method: %s", v)
		}
		action.HTTPMethod = v
	}
	if v, ok := updates["endpoint"].(string); ok {
		action.Endpoint = v
	}
	if err := sess.ConnectorActions().Update(ctx, action); err != nil {
		return nil, fmt.Errorf("update connector action: %w", err)
	}
	return action, nil
}

func (s *ConnectorService) DeleteAction(ctx context.Context, tenantID, id uuid.UUID) error {
	sess := s.store.WithTenant(ctx, tenantID)
	if err := sess.ConnectorActions().Delete(ctx, id); err != nil {
		return fmt.Errorf("delete connector action: %w", err)
	}
	return nil
}

func (s *ConnectorService) ListActions(ctx context.Context, tenantID, connectorID uuid.UUID, limit, offset int) ([]models.ConnectorAction, int64, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	if repo, ok := any(sess.ConnectorActions()).(byFieldRepo[models.ConnectorAction]); ok {
		items, err := repo.ListByField(ctx, "connector_id", connectorID, limit, offset)
		if err != nil {
			return nil, 0, fmt.Errorf("list connector actions: %w", err)
		}
		return items, int64(len(items)), nil
	}
	items, err := sess.ConnectorActions().ListByTenant(ctx, tenantID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list connector actions: %w", err)
	}
	var filtered []models.ConnectorAction
	for _, item := range items {
		if item.ConnectorID == connectorID {
			filtered = append(filtered, item)
		}
	}
	return filtered, int64(len(filtered)), nil
}
