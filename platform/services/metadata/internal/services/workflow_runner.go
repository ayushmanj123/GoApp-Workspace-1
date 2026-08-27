package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/shared/secrets"
	"github.com/google/uuid"
)

const (
	errConnectorUserOAuthRequired = "connector_user_oauth_required"
	maxBodyPreview                = 512
)

// WorkflowRunner executes connector_action steps over HTTP.
type WorkflowRunner struct {
	client *http.Client
}

func NewWorkflowRunner() *WorkflowRunner {
	return &WorkflowRunner{
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

// Execute runs steps in order; stops on first failure.
func (r *WorkflowRunner) Execute(
	ctx context.Context,
	sess repositories.TenantSession,
	tenantID, userID uuid.UUID,
	steps []WorkflowStep,
) (WorkflowRunResult, error) {
	result := WorkflowRunResult{Steps: make([]WorkflowStepResult, 0, len(steps))}
	for _, step := range steps {
		stepResult, err := r.executeStep(ctx, sess, tenantID, userID, step)
		result.Steps = append(result.Steps, stepResult)
		if err != nil {
			result.Error = err.Error()
			return result, err
		}
	}
	return result, nil
}

func (r *WorkflowRunner) executeStep(
	ctx context.Context,
	sess repositories.TenantSession,
	tenantID, userID uuid.UUID,
	step WorkflowStep,
) (WorkflowStepResult, error) {
	out := WorkflowStepResult{StepID: step.ID, Status: "failed"}
	connectorID, err := uuid.Parse(step.ConnectorID)
	if err != nil {
		out.Error = "invalid connector_id"
		return out, fmt.Errorf("%s", out.Error)
	}
	connector, err := sess.Connectors().GetByID(ctx, connectorID)
	if err != nil || connector == nil {
		out.Error = "connector not found"
		return out, fmt.Errorf("%s", out.Error)
	}
	action, err := findConnectorAction(ctx, sess, connectorID, step.ActionName)
	if err != nil {
		out.Error = err.Error()
		return out, err
	}

	cfg, err := parseAuthConfig(connector.AuthConfig)
	if err != nil {
		out.Error = err.Error()
		return out, err
	}
	if cfg.Type == "" {
		cfg.Type = connector.AuthenticationType
	}

	req, err := buildConnectorRequest(ctx, connector.BaseURL, action.HTTPMethod, action.Endpoint, step.Body)
	if err != nil {
		out.Error = err.Error()
		return out, err
	}
	if err := applyConnectorAuth(ctx, sess, tenantID, userID, connector, &cfg, req); err != nil {
		out.Error = err.Error()
		return out, err
	}

	res, err := r.client.Do(req)
	if err != nil {
		out.Error = fmt.Sprintf("http request failed: %v", err)
		return out, fmt.Errorf("%s", out.Error)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	out.HTTPStatus = res.StatusCode
	out.BodyPreview = truncatePreview(string(body))
	if res.StatusCode >= 400 {
		out.Error = fmt.Sprintf("connector returned status %d", res.StatusCode)
		return out, fmt.Errorf("%s", out.Error)
	}
	out.Status = "succeeded"
	return out, nil
}

func findConnectorAction(ctx context.Context, sess repositories.TenantSession, connectorID uuid.UUID, actionName string) (*models.ConnectorAction, error) {
	actions, err := listConnectorActions(ctx, sess, connectorID)
	if err != nil {
		return nil, err
	}
	for i := range actions {
		if strings.EqualFold(actions[i].ActionName, actionName) {
			return &actions[i], nil
		}
	}
	return nil, fmt.Errorf("action %q not found", actionName)
}

func buildConnectorRequest(ctx context.Context, baseURL, method, endpoint string, body json.RawMessage) (*http.Request, error) {
	target, err := joinURL(baseURL, endpoint)
	if err != nil {
		return nil, err
	}
	var reader io.Reader
	if len(body) > 0 && string(body) != "null" {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, strings.ToUpper(method), target, reader)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	if reader != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return req, nil
}

func joinURL(baseURL, endpoint string) (string, error) {
	baseURL = strings.TrimSpace(baseURL)
	endpoint = strings.TrimSpace(endpoint)
	if baseURL == "" {
		return "", fmt.Errorf("connector base_url is required")
	}
	base, err := url.Parse(baseURL)
	if err != nil {
		return "", fmt.Errorf("invalid base_url: %w", err)
	}
	ref, err := url.Parse(endpoint)
	if err != nil {
		return "", fmt.Errorf("invalid endpoint: %w", err)
	}
	return base.ResolveReference(ref).String(), nil
}

func applyConnectorAuth(
	ctx context.Context,
	sess repositories.TenantSession,
	tenantID, userID uuid.UUID,
	connector *models.Connector,
	cfg *connectorAuthConfig,
	req *http.Request,
) error {
	typ := strings.ToLower(strings.TrimSpace(cfg.Type))
	switch typ {
	case "", "none":
		return nil
	case "header":
		plain, err := decryptNamedSecret(ctx, sess, cfg.SecretID)
		if err != nil {
			if strings.TrimSpace(cfg.HeaderValue) != "" {
				req.Header.Set(cfg.HeaderName, cfg.HeaderValue)
				return nil
			}
			return err
		}
		name := cfg.HeaderName
		if name == "" {
			name = "Authorization"
		}
		req.Header.Set(name, plain)
		return nil
	case "oauth_client_credentials", "oauth_authorization_code":
		token, err := obtainOAuthAccessToken(ctx, sess, tenantID, userID, connector, cfg)
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+token)
		return nil
	default:
		return fmt.Errorf("unsupported connector authentication_type %q for workflows", cfg.Type)
	}
}

func obtainOAuthAccessToken(
	ctx context.Context,
	sess repositories.TenantSession,
	tenantID, userID uuid.UUID,
	connector *models.Connector,
	cfg *connectorAuthConfig,
) (string, error) {
	clientSecret, err := decryptNamedSecret(ctx, sess, cfg.SecretID)
	if err != nil {
		return "", err
	}
	form := url.Values{}
	if strings.EqualFold(cfg.Type, "oauth_authorization_code") {
		refresh, err := resolveRefreshToken(ctx, sess, tenantID, userID, connector.ID, cfg)
		if err != nil {
			return "", err
		}
		form.Set("grant_type", "refresh_token")
		form.Set("refresh_token", refresh)
		form.Set("client_id", cfg.ClientID)
		form.Set("client_secret", clientSecret)
	} else {
		form.Set("grant_type", "client_credentials")
		form.Set("client_id", cfg.ClientID)
		form.Set("client_secret", clientSecret)
		if scope := strings.TrimSpace(cfg.Scope); scope != "" {
			form.Set("scope", scope)
		}
	}
	if strings.TrimSpace(cfg.TokenURL) == "" {
		return "", fmt.Errorf("oauth token_url is required")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.TokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("build token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("token request failed: %w", err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return "", fmt.Errorf("read token response: %w", err)
	}
	if res.StatusCode >= 400 {
		return "", fmt.Errorf("token endpoint returned %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}
	var parsed struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", fmt.Errorf("parse token response: %w", err)
	}
	if strings.TrimSpace(parsed.AccessToken) == "" {
		return "", fmt.Errorf("token response missing access_token")
	}
	return parsed.AccessToken, nil
}

func resolveRefreshToken(
	ctx context.Context,
	sess repositories.TenantSession,
	tenantID, userID, connectorID uuid.UUID,
	cfg *connectorAuthConfig,
) (string, error) {
	scope := normalizeConnectionScope(cfg.ConnectionScope)
	if scope == "" {
		scope = "app"
	}
	if scope == "user" {
		if userID == uuid.Nil {
			return "", fmt.Errorf("%s: missing user id", errConnectorUserOAuthRequired)
		}
		conn, err := findUserConnection(ctx, sess, connectorID, userID)
		if err != nil {
			return "", err
		}
		if conn == nil {
			return "", fmt.Errorf("%s: connector %s", errConnectorUserOAuthRequired, connectorID)
		}
		return decryptSecretByID(ctx, sess, conn.RefreshSecretID)
	}
	if strings.TrimSpace(cfg.RefreshSecretID) == "" {
		return "", fmt.Errorf("oauth_authorization_code connector is not connected")
	}
	id, err := uuid.Parse(cfg.RefreshSecretID)
	if err != nil {
		return "", fmt.Errorf("invalid refresh_secret_id: %w", err)
	}
	_ = tenantID
	return decryptSecretByID(ctx, sess, id)
}

func decryptSecretByID(ctx context.Context, sess repositories.TenantSession, id uuid.UUID) (string, error) {
	sec, err := sess.Secrets().GetByID(ctx, id)
	if err != nil || sec == nil {
		return "", fmt.Errorf("load secret: %w", err)
	}
	key, err := secrets.LoadMasterKeyFromEnv()
	if err != nil {
		return "", fmt.Errorf("load secrets master key: %w", err)
	}
	plain, err := secrets.Decrypt(key, sec.Ciphertext, sec.Nonce)
	if err != nil {
		return "", fmt.Errorf("decrypt secret: %w", err)
	}
	return string(plain), nil
}

func truncatePreview(s string) string {
	s = strings.TrimSpace(s)
	if len(s) <= maxBodyPreview {
		return s
	}
	return s[:maxBodyPreview] + "…"
}
