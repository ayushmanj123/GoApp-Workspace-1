package databinding

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/goapps-platform/shared/ssrf"
	"github.com/google/uuid"
)

// REST action name conventions resolved against connector_actions.action_name.
const (
	restActionList   = "list"
	restActionGet    = "get"
	restActionCreate = "create"
	restActionUpdate = "update"
	restActionDelete = "delete"
)

// RestDataSource executes datasource queries against externally configured
// REST connectors (connectors + connector_actions metadata). Auth supports
// none, static header, and OAuth2 client_credentials.
type RestDataSource struct {
	repo       RestConnectorRepository
	client     *http.Client
	tokenCache sync.Map // connectorID -> cachedOAuthToken
}

type cachedOAuthToken struct {
	AccessToken string
	ExpiresAt   time.Time
}

// NewRestDataSource builds a REST datasource. If httpClient is nil, a client
// with a sane default timeout is used.
func NewRestDataSource(repo RestConnectorRepository, httpClient *http.Client) *RestDataSource {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 15 * time.Second}
	}
	return &RestDataSource{repo: repo, client: httpClient}
}

func (d *RestDataSource) Kind() DataSourceKind {
	return DataSourceKindRest
}

func (d *RestDataSource) Query(ctx context.Context, input QueryInput) (*QueryResult, error) {
	connectorID := input.EntityID
	cfg, action, err := d.resolveAction(ctx, input.TenantID, input.UserID, connectorID, restActionList, input.EnvironmentID)
	if err != nil {
		return nil, err
	}

	endpoint := action.Endpoint
	query := url.Values{}
	pushParams := input.FilterExpr.IsEqualsAndOnly()
	if pushParams {
		for _, leaf := range input.FilterExpr.Leaves {
			query.Set(leaf.Field, leaf.Value)
		}
	}
	if input.Limit > 0 {
		query.Set("limit", strconv.Itoa(input.Limit))
	}
	if input.Offset > 0 {
		query.Set("offset", strconv.Itoa(input.Offset))
	}
	if input.OrderBy != "" {
		query.Set("sort", orderExpression(input.OrderBy, input.OrderDirection))
	}

	body, _, err := d.do(ctx, cfg, input.UserID, action.HTTPMethod, endpoint, query, nil)
	if err != nil {
		return nil, err
	}

	items, err := decodeItems(body)
	if err != nil {
		return nil, err
	}
	if !pushParams && !input.FilterExpr.Empty() {
		filtered := make([]DataItem, 0, len(items))
		for _, item := range items {
			if MatchFilterExpr(map[string]interface{}(item), input.FilterExpr) {
				filtered = append(filtered, item)
			}
		}
		items = filtered
	}
	return &QueryResult{Items: items, Count: int64(len(items))}, nil
}

func (d *RestDataSource) Get(ctx context.Context, tenantID, userID uuid.UUID, key DataSourceKey, recordID uuid.UUID) (*DataItem, error) {
	cfg, action, err := d.resolveAction(ctx, tenantID, userID, key.EntityID, restActionGet, nil)
	if err != nil {
		return nil, err
	}
	endpoint := substituteRecordID(action.Endpoint, recordID)
	body, _, err := d.do(ctx, cfg, userID, action.HTTPMethod, endpoint, nil, nil)
	if err != nil {
		return nil, err
	}
	item, err := decodeItem(body)
	if err != nil {
		return nil, err
	}
	return item, nil
}

func (d *RestDataSource) Create(ctx context.Context, tenantID, userID uuid.UUID, key DataSourceKey, data map[string]interface{}) (*DataItem, error) {
	cfg, action, err := d.resolveAction(ctx, tenantID, userID, key.EntityID, restActionCreate, nil)
	if err != nil {
		return nil, err
	}
	payload, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("databinding: encode rest create payload: %w", err)
	}
	body, _, err := d.do(ctx, cfg, userID, action.HTTPMethod, action.Endpoint, nil, payload)
	if err != nil {
		return nil, err
	}
	return decodeItem(body)
}

func (d *RestDataSource) Update(ctx context.Context, tenantID, userID uuid.UUID, key DataSourceKey, recordID uuid.UUID, data map[string]interface{}, version int) (*DataItem, error) {
	_ = version
	cfg, action, err := d.resolveAction(ctx, tenantID, userID, key.EntityID, restActionUpdate, nil)
	if err != nil {
		return nil, err
	}
	endpoint := substituteRecordID(action.Endpoint, recordID)
	payload, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("databinding: encode rest update payload: %w", err)
	}
	body, _, err := d.do(ctx, cfg, userID, action.HTTPMethod, endpoint, nil, payload)
	if err != nil {
		return nil, err
	}
	return decodeItem(body)
}

func (d *RestDataSource) Delete(ctx context.Context, tenantID, userID uuid.UUID, key DataSourceKey, recordID uuid.UUID) error {
	cfg, action, err := d.resolveAction(ctx, tenantID, userID, key.EntityID, restActionDelete, nil)
	if err != nil {
		return err
	}
	endpoint := substituteRecordID(action.Endpoint, recordID)
	_, _, err = d.do(ctx, cfg, userID, action.HTTPMethod, endpoint, nil, nil)
	return err
}

func (d *RestDataSource) resolveAction(ctx context.Context, tenantID, userID, connectorID uuid.UUID, actionName string, environmentID *uuid.UUID) (*RestConnectorConfig, *RestConnectorAction, error) {
	if d == nil || d.repo == nil {
		return nil, nil, fmt.Errorf("databinding: rest datasource is not configured")
	}
	envID := coalesceEnvironmentID(environmentID, ctx)
	cfg, err := d.repo.GetConnectorConfig(ctx, tenantID, connectorID, envID, userID)
	if err != nil {
		return nil, nil, err
	}
	action, err := d.repo.GetAction(ctx, tenantID, connectorID, actionName)
	if err != nil {
		return nil, nil, err
	}
	return cfg, action, nil
}

func (d *RestDataSource) do(ctx context.Context, cfg *RestConnectorConfig, userID uuid.UUID, method, endpoint string, query url.Values, payload []byte) ([]byte, int, error) {
	target, err := buildURL(cfg.BaseURL, endpoint, query)
	if err != nil {
		return nil, 0, fmt.Errorf("databinding: build rest url: %w", err)
	}
	if err := ssrf.ValidateHTTPURL(target); err != nil {
		return nil, 0, fmt.Errorf("databinding: rest url blocked: %w", err)
	}

	var reader io.Reader
	if len(payload) > 0 {
		reader = bytes.NewReader(payload)
	}
	req, err := http.NewRequestWithContext(ctx, strings.ToUpper(method), target, reader)
	if err != nil {
		return nil, 0, fmt.Errorf("databinding: build rest request: %w", err)
	}
	if len(payload) > 0 {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/json")
	if err := d.applyAuth(ctx, cfg, userID, req); err != nil {
		return nil, 0, err
	}

	res, err := d.client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("databinding: rest request failed: %w", err)
	}
	defer res.Body.Close()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, res.StatusCode, fmt.Errorf("databinding: read rest response: %w", err)
	}
	if res.StatusCode >= 400 {
		return nil, res.StatusCode, fmt.Errorf("databinding: rest connector returned status %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}
	return body, res.StatusCode, nil
}

func (d *RestDataSource) applyAuth(ctx context.Context, cfg *RestConnectorConfig, userID uuid.UUID, req *http.Request) error {
	auth := cfg.Auth
	if strings.EqualFold(auth.Type, "header") && auth.HeaderName != "" {
		req.Header.Set(auth.HeaderName, auth.HeaderValue)
		return nil
	}
	if strings.EqualFold(auth.Type, "oauth_client_credentials") || strings.EqualFold(auth.Type, "oauth_authorization_code") {
		token, err := d.oauthAccessToken(ctx, cfg, userID)
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+token)
	}
	return nil
}

func (d *RestDataSource) oauthAccessToken(ctx context.Context, cfg *RestConnectorConfig, userID uuid.UUID) (string, error) {
	key := cfg.ConnectorID.String()
	if strings.EqualFold(cfg.Auth.ConnectionScope, "user") && userID != uuid.Nil {
		key = key + ":" + userID.String()
	}
	if cached, ok := d.tokenCache.Load(key); ok {
		tok := cached.(cachedOAuthToken)
		if time.Now().Before(tok.ExpiresAt) {
			return tok.AccessToken, nil
		}
	}
	if strings.TrimSpace(cfg.Auth.TokenURL) == "" {
		return "", fmt.Errorf("databinding: oauth token_url is required")
	}
	if err := ssrf.ValidateHTTPURL(cfg.Auth.TokenURL); err != nil {
		return "", fmt.Errorf("databinding: oauth token_url blocked: %w", err)
	}
	if strings.TrimSpace(cfg.Auth.ClientID) == "" || strings.TrimSpace(cfg.Auth.ClientSecret) == "" {
		return "", fmt.Errorf("databinding: oauth client_id and client_secret are required")
	}

	form := url.Values{}
	if strings.EqualFold(cfg.Auth.Type, "oauth_authorization_code") {
		if strings.TrimSpace(cfg.Auth.RefreshToken) == "" {
			if strings.EqualFold(cfg.Auth.ConnectionScope, "user") {
				return "", fmt.Errorf("%w: connector %s", ErrConnectorUserOAuthRequired, cfg.ConnectorID)
			}
			return "", fmt.Errorf("databinding: oauth_authorization_code connector is not connected")
		}
		form.Set("grant_type", "refresh_token")
		form.Set("refresh_token", cfg.Auth.RefreshToken)
		form.Set("client_id", cfg.Auth.ClientID)
		form.Set("client_secret", cfg.Auth.ClientSecret)
	} else {
		form.Set("grant_type", "client_credentials")
		form.Set("client_id", cfg.Auth.ClientID)
		form.Set("client_secret", cfg.Auth.ClientSecret)
		if scope := strings.TrimSpace(cfg.Auth.Scope); scope != "" {
			form.Set("scope", scope)
		}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.Auth.TokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("databinding: build oauth token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	res, err := d.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("databinding: oauth token request failed: %w", err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return "", fmt.Errorf("databinding: read oauth token response: %w", err)
	}
	if res.StatusCode >= 400 {
		return "", fmt.Errorf("databinding: oauth token endpoint returned %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}

	var parsed struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		TokenType   string `json:"token_type"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", fmt.Errorf("databinding: parse oauth token response: %w", err)
	}
	if strings.TrimSpace(parsed.AccessToken) == "" {
		return "", fmt.Errorf("databinding: oauth token response missing access_token")
	}
	expiresIn := parsed.ExpiresIn
	if expiresIn <= 0 {
		expiresIn = 3600
	}
	// Refresh slightly before expiry.
	skew := 30
	if expiresIn > skew {
		expiresIn -= skew
	}
	d.tokenCache.Store(key, cachedOAuthToken{
		AccessToken: parsed.AccessToken,
		ExpiresAt:   time.Now().Add(time.Duration(expiresIn) * time.Second),
	})
	return parsed.AccessToken, nil
}

func applyAuth(req *http.Request, auth RestAuthConfig) {
	if strings.EqualFold(auth.Type, "header") && auth.HeaderName != "" {
		req.Header.Set(auth.HeaderName, auth.HeaderValue)
	}
}

func buildURL(baseURL, endpoint string, query url.Values) (string, error) {
	base := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	path := strings.TrimSpace(endpoint)
	if path != "" && !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	full := base + path
	parsed, err := url.Parse(full)
	if err != nil {
		return "", err
	}
	if len(query) > 0 {
		existing := parsed.Query()
		for key, values := range query {
			for _, value := range values {
				existing.Set(key, value)
			}
		}
		parsed.RawQuery = existing.Encode()
	}
	return parsed.String(), nil
}

func substituteRecordID(endpoint string, recordID uuid.UUID) string {
	id := recordID.String()
	replaced := strings.ReplaceAll(endpoint, "{id}", id)
	replaced = strings.ReplaceAll(replaced, ":id", id)
	return replaced
}

func orderExpression(orderBy, direction string) string {
	if direction == "" {
		return orderBy
	}
	if strings.EqualFold(direction, "desc") {
		return "-" + orderBy
	}
	return orderBy
}

// decodeItems parses a REST list response. Supported shapes:
//   - a JSON array of objects
//   - {"items": [...]} or {"data": [...]}
//   - a single JSON object (treated as a one-item result)
func decodeItems(body []byte) ([]DataItem, error) {
	body = bytes.TrimSpace(body)
	if len(body) == 0 {
		return []DataItem{}, nil
	}

	var array []map[string]interface{}
	if err := json.Unmarshal(body, &array); err == nil {
		return toDataItems(array), nil
	}

	var wrapped map[string]interface{}
	if err := json.Unmarshal(body, &wrapped); err != nil {
		return nil, fmt.Errorf("databinding: decode rest response: %w", err)
	}
	for _, key := range []string{"items", "data", "results"} {
		if raw, ok := wrapped[key]; ok {
			bytesRaw, err := json.Marshal(raw)
			if err != nil {
				return nil, fmt.Errorf("databinding: decode rest response field %q: %w", key, err)
			}
			var nested []map[string]interface{}
			if err := json.Unmarshal(bytesRaw, &nested); err == nil {
				return toDataItems(nested), nil
			}
		}
	}
	return []DataItem{DataItem(wrapped)}, nil
}

// decodeItem parses a REST single-record response.
func decodeItem(body []byte) (*DataItem, error) {
	body = bytes.TrimSpace(body)
	if len(body) == 0 {
		return &DataItem{}, nil
	}
	var wrapped map[string]interface{}
	if err := json.Unmarshal(body, &wrapped); err != nil {
		return nil, fmt.Errorf("databinding: decode rest response: %w", err)
	}
	if raw, ok := wrapped["data"]; ok {
		if nested, ok := raw.(map[string]interface{}); ok {
			item := DataItem(nested)
			return &item, nil
		}
	}
	item := DataItem(wrapped)
	return &item, nil
}

func toDataItems(rows []map[string]interface{}) []DataItem {
	items := make([]DataItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, DataItem(row))
	}
	return items
}
