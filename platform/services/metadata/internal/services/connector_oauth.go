package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/shared/secrets"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

const oauthPendingTTL = 10 * time.Minute

type oauthPendingState struct {
	TenantID     uuid.UUID
	ConnectorID  uuid.UUID
	UserID       uuid.UUID
	ReturnTo     string // studio | runtime
	CodeVerifier string
	ExpiresAt    time.Time
}

var (
	oauthPendingMu sync.Mutex
	oauthPending   = map[string]oauthPendingState{}
)

// OAuthStartResult is returned to Studio/Runtime to open the IdP authorize URL.
type OAuthStartResult struct {
	AuthorizeURL string `json:"authorize_url"`
	State        string `json:"state"`
}

// OAuthConnectionStatus is the current user's connection flag for a connector.
type OAuthConnectionStatus struct {
	Connected       bool   `json:"connected"`
	ConnectionScope string `json:"connection_scope"`
}

func connectorOAuthRedirectURI() string {
	if v := strings.TrimSpace(os.Getenv("OAUTH_CONNECTOR_REDIRECT_URI")); v != "" {
		return v
	}
	return "http://localhost:8082/api/v1/connectors/oauth/callback"
}

func connectorOAuthStudioReturnURL() string {
	if v := strings.TrimSpace(os.Getenv("OAUTH_CONNECTOR_STUDIO_RETURN_URL")); v != "" {
		return v
	}
	return "http://localhost:5173/studio/connectors"
}

func connectorOAuthRuntimeReturnURL() string {
	if v := strings.TrimSpace(os.Getenv("OAUTH_CONNECTOR_RUNTIME_RETURN_URL")); v != "" {
		return v
	}
	return "http://localhost:5174/?oauth=connected"
}

func storeOAuthPending(state string, pending oauthPendingState) {
	oauthPendingMu.Lock()
	defer oauthPendingMu.Unlock()
	now := time.Now()
	for k, v := range oauthPending {
		if now.After(v.ExpiresAt) {
			delete(oauthPending, k)
		}
	}
	oauthPending[state] = pending
}

func takeOAuthPending(state string) (oauthPendingState, bool) {
	oauthPendingMu.Lock()
	defer oauthPendingMu.Unlock()
	pending, ok := oauthPending[state]
	if !ok {
		return oauthPendingState{}, false
	}
	delete(oauthPending, state)
	if time.Now().After(pending.ExpiresAt) {
		return oauthPendingState{}, false
	}
	return pending, true
}

func randomURLSafe(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func pkceChallengeS256(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func normalizeOAuthReturnTo(v string) string {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "runtime":
		return "runtime"
	default:
		return "studio"
	}
}

// StartOAuthAuthorizationCode builds the IdP authorize URL and stores PKCE state.
func (s *ConnectorService) StartOAuthAuthorizationCode(ctx context.Context, tenantID, connectorID, userID uuid.UUID, returnTo string) (*OAuthStartResult, error) {
	if userID == uuid.Nil {
		return nil, fmt.Errorf("user id is required to start oauth")
	}
	returnTo = normalizeOAuthReturnTo(returnTo)

	sess := s.store.WithTenant(ctx, tenantID)
	connector, err := sess.Connectors().GetByID(ctx, connectorID)
	if err != nil {
		return nil, fmt.Errorf("get connector: %w", err)
	}
	if !strings.EqualFold(connector.AuthenticationType, "oauth_authorization_code") {
		return nil, fmt.Errorf("connector authentication_type must be oauth_authorization_code")
	}
	cfg, err := parseAuthConfig(connector.AuthConfig)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(cfg.AuthorizationURL) == "" || strings.TrimSpace(cfg.ClientID) == "" {
		return nil, fmt.Errorf("auth_config.authorization_url and client_id are required")
	}

	verifier, err := randomURLSafe(32)
	if err != nil {
		return nil, fmt.Errorf("generate code_verifier: %w", err)
	}
	state, err := randomURLSafe(24)
	if err != nil {
		return nil, fmt.Errorf("generate state: %w", err)
	}
	storeOAuthPending(state, oauthPendingState{
		TenantID:     tenantID,
		ConnectorID:  connectorID,
		UserID:       userID,
		ReturnTo:     returnTo,
		CodeVerifier: verifier,
		ExpiresAt:    time.Now().Add(oauthPendingTTL),
	})

	q := url.Values{}
	q.Set("response_type", "code")
	q.Set("client_id", cfg.ClientID)
	q.Set("redirect_uri", connectorOAuthRedirectURI())
	q.Set("state", state)
	q.Set("code_challenge", pkceChallengeS256(verifier))
	q.Set("code_challenge_method", "S256")
	if scope := strings.TrimSpace(cfg.Scope); scope != "" {
		q.Set("scope", scope)
	}

	authorizeURL := strings.TrimSpace(cfg.AuthorizationURL)
	sep := "?"
	if strings.Contains(authorizeURL, "?") {
		sep = "&"
	}
	return &OAuthStartResult{
		AuthorizeURL: authorizeURL + sep + q.Encode(),
		State:        state,
	}, nil
}

// CompleteOAuthCallback exchanges the authorization code for tokens and stores the refresh token.
// Returns the Studio or Runtime redirect URL on success.
func (s *ConnectorService) CompleteOAuthCallback(ctx context.Context, code, state string) (string, error) {
	pending, ok := takeOAuthPending(state)
	if !ok {
		return "", fmt.Errorf("invalid or expired oauth state")
	}
	if strings.TrimSpace(code) == "" {
		return "", fmt.Errorf("missing authorization code")
	}

	sess := s.store.WithTenant(ctx, pending.TenantID)
	connector, err := sess.Connectors().GetByID(ctx, pending.ConnectorID)
	if err != nil {
		return "", fmt.Errorf("get connector: %w", err)
	}
	cfg, err := parseAuthConfig(connector.AuthConfig)
	if err != nil {
		return "", err
	}
	connectionScope := normalizeConnectionScope(cfg.ConnectionScope)
	if connectionScope == "" {
		connectionScope = "app"
	}

	clientSecret, err := decryptNamedSecret(ctx, sess, cfg.SecretID)
	if err != nil {
		return "", err
	}

	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", connectorOAuthRedirectURI())
	form.Set("client_id", cfg.ClientID)
	form.Set("client_secret", clientSecret)
	form.Set("code_verifier", pending.CodeVerifier)

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
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", fmt.Errorf("parse token response: %w", err)
	}
	if strings.TrimSpace(parsed.RefreshToken) == "" {
		return "", fmt.Errorf("token response missing refresh_token")
	}

	storeUserConnection := connectionScope == "user"
	if storeUserConnection {
		if err := s.upsertUserRefreshConnection(
			ctx, sess, pending.TenantID, connector, pending.UserID, parsed.RefreshToken,
		); err != nil {
			return "", err
		}
		// User-scoped connectors must not keep a shared connector-level refresh.
		if connectionScope == "user" && strings.TrimSpace(cfg.RefreshSecretID) != "" {
			cfg.RefreshSecretID = ""
			out, err := json.Marshal(cfg)
			if err != nil {
				return "", fmt.Errorf("marshal auth_config: %w", err)
			}
			connector.AuthConfig = datatypes.JSON(out)
			if err := sess.Connectors().Update(ctx, connector); err != nil {
				return "", fmt.Errorf("update connector: %w", err)
			}
		}
	} else {
		refreshSecretID, err := s.upsertNamedSecret(
			ctx, sess, pending.TenantID, connector.ApplicationID,
			connector.Name, "refresh_token", parsed.RefreshToken, cfg.RefreshSecretID,
		)
		if err != nil {
			return "", err
		}
		cfg.RefreshSecretID = refreshSecretID
		cfg.ConnectionScope = "app"
		out, err := json.Marshal(cfg)
		if err != nil {
			return "", fmt.Errorf("marshal auth_config: %w", err)
		}
		connector.AuthConfig = datatypes.JSON(out)
		if err := sess.Connectors().Update(ctx, connector); err != nil {
			return "", fmt.Errorf("update connector: %w", err)
		}
	}

	returnURL := connectorOAuthStudioReturnURL()
	if pending.ReturnTo == "runtime" {
		returnURL = connectorOAuthRuntimeReturnURL()
	}
	u, err := url.Parse(returnURL)
	if err != nil {
		return returnURL + "?oauth=connected&id=" + pending.ConnectorID.String(), nil
	}
	q := u.Query()
	q.Set("oauth", "connected")
	q.Set("id", pending.ConnectorID.String())
	u.RawQuery = q.Encode()
	return u.String(), nil
}

// GetOAuthConnectionStatus reports whether the current user (or app) is connected.
func (s *ConnectorService) GetOAuthConnectionStatus(ctx context.Context, tenantID, connectorID, userID uuid.UUID) (*OAuthConnectionStatus, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	connector, err := sess.Connectors().GetByID(ctx, connectorID)
	if err != nil {
		return nil, fmt.Errorf("get connector: %w", err)
	}
	cfg, err := parseAuthConfig(connector.AuthConfig)
	if err != nil {
		return nil, err
	}
	scope := normalizeConnectionScope(cfg.ConnectionScope)
	if scope == "" {
		scope = "app"
	}
	status := &OAuthConnectionStatus{ConnectionScope: scope}
	if scope == "user" {
		if userID == uuid.Nil {
			return status, nil
		}
		conn, err := findUserConnection(ctx, sess, connectorID, userID)
		if err != nil {
			return nil, err
		}
		status.Connected = conn != nil
		return status, nil
	}
	status.Connected = strings.TrimSpace(cfg.RefreshSecretID) != ""
	return status, nil
}

// DisconnectOAuthConnection removes the current user's refresh connection (user scope)
// or clears the app-level refresh_secret_id (app scope).
func (s *ConnectorService) DisconnectOAuthConnection(ctx context.Context, tenantID, connectorID, userID uuid.UUID) error {
	sess := s.store.WithTenant(ctx, tenantID)
	connector, err := sess.Connectors().GetByID(ctx, connectorID)
	if err != nil {
		return fmt.Errorf("get connector: %w", err)
	}
	cfg, err := parseAuthConfig(connector.AuthConfig)
	if err != nil {
		return err
	}
	scope := normalizeConnectionScope(cfg.ConnectionScope)
	if scope == "" {
		scope = "app"
	}
	if scope == "user" {
		if userID == uuid.Nil {
			return fmt.Errorf("user id is required")
		}
		conn, err := findUserConnection(ctx, sess, connectorID, userID)
		if err != nil {
			return err
		}
		if conn == nil {
			return nil
		}
		return sess.ConnectorUserConnections().Delete(ctx, conn.ID)
	}
	cfg.RefreshSecretID = ""
	out, err := json.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("marshal auth_config: %w", err)
	}
	connector.AuthConfig = datatypes.JSON(out)
	return sess.Connectors().Update(ctx, connector)
}

func (s *ConnectorService) upsertUserRefreshConnection(
	ctx context.Context,
	sess repositories.TenantSession,
	tenantID uuid.UUID,
	connector *models.Connector,
	userID uuid.UUID,
	refreshToken string,
) error {
	if userID == uuid.Nil {
		return fmt.Errorf("user id is required for per-user oauth")
	}
	existingID := ""
	existing, err := findUserConnection(ctx, sess, connector.ID, userID)
	if err != nil {
		return err
	}
	if existing != nil {
		existingID = existing.RefreshSecretID.String()
	}
	secretName := fmt.Sprintf("%s:user:%s", connector.Name, userID.String())
	refreshSecretID, err := s.upsertNamedSecret(
		ctx, sess, tenantID, connector.ApplicationID,
		secretName, "refresh_token", refreshToken, existingID,
	)
	if err != nil {
		return err
	}
	secretUUID, err := uuid.Parse(refreshSecretID)
	if err != nil {
		return fmt.Errorf("invalid refresh_secret_id: %w", err)
	}
	if existing != nil {
		existing.RefreshSecretID = secretUUID
		return sess.ConnectorUserConnections().Update(ctx, existing)
	}
	row := &models.ConnectorUserConnection{
		TenantID:        tenantID,
		ConnectorID:     connector.ID,
		UserID:          userID,
		RefreshSecretID: secretUUID,
	}
	return sess.ConnectorUserConnections().Create(ctx, row)
}

func findUserConnection(ctx context.Context, sess repositories.TenantSession, connectorID, userID uuid.UUID) (*models.ConnectorUserConnection, error) {
	repo, ok := any(sess.ConnectorUserConnections()).(byFieldRepo[models.ConnectorUserConnection])
	if !ok {
		return nil, fmt.Errorf("connector user connections repository unavailable")
	}
	items, err := repo.ListByField(ctx, "connector_id", connectorID, 500, 0)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("list user connections: %w", err)
	}
	for i := range items {
		if items[i].UserID == userID {
			return &items[i], nil
		}
	}
	return nil, nil
}

func decryptNamedSecret(ctx context.Context, sess repositories.TenantSession, secretID string) (string, error) {
	if strings.TrimSpace(secretID) == "" {
		return "", fmt.Errorf("connector client_secret is not configured")
	}
	id, err := uuid.Parse(secretID)
	if err != nil {
		return "", fmt.Errorf("invalid secret_id: %w", err)
	}
	sec, err := sess.Secrets().GetByID(ctx, id)
	if err != nil || sec == nil {
		return "", fmt.Errorf("load client_secret: %w", err)
	}
	key, err := secrets.LoadMasterKey(true)
	if err != nil {
		return "", fmt.Errorf("load secrets master key: %w", err)
	}
	plain, err := secrets.Decrypt(key, sec.Ciphertext, sec.Nonce)
	if err != nil {
		return "", fmt.Errorf("decrypt client_secret: %w", err)
	}
	return string(plain), nil
}
