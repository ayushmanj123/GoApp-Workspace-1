package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type googleTokenCache struct {
	mu     sync.Mutex
	tokens map[string]cachedGoogleToken
}

type cachedGoogleToken struct {
	AccessToken string
	ExpiresAt   time.Time
}

var googleTokens = &googleTokenCache{tokens: map[string]cachedGoogleToken{}}

func (c *googleTokenCache) get(key string) (string, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	tok, ok := c.tokens[key]
	if !ok || time.Now().After(tok.ExpiresAt) {
		return "", false
	}
	return tok.AccessToken, true
}

func (c *googleTokenCache) set(key, accessToken string, expiresIn int) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if expiresIn <= 0 {
		expiresIn = 3600
	}
	skew := 30
	if expiresIn > skew {
		expiresIn -= skew
	}
	c.tokens[key] = cachedGoogleToken{
		AccessToken: accessToken,
		ExpiresAt:   time.Now().Add(time.Duration(expiresIn) * time.Second),
	}
}

func (s *ConnectorService) googleAccessToken(ctx context.Context, tenantID, connectorID, userID uuid.UUID) (string, error) {
	cacheKey := connectorID.String()
	sess := s.store.WithTenant(ctx, tenantID)
	connector, err := sess.Connectors().GetByID(ctx, connectorID)
	if err != nil {
		return "", fmt.Errorf("get connector: %w", err)
	}
	cfg, err := parseAuthConfig(connector.AuthConfig)
	if err != nil {
		return "", err
	}
	scope := normalizeConnectionScope(cfg.ConnectionScope)
	if scope == "" {
		scope = "user"
	}
	if scope == "user" {
		if userID == uuid.Nil {
			return "", fmt.Errorf("user id required for google sheets connector")
		}
		cacheKey = cacheKey + ":" + userID.String()
	}
	if token, ok := googleTokens.get(cacheKey); ok {
		return token, nil
	}

	clientSecret, err := decryptNamedSecret(ctx, sess, cfg.SecretID)
	if err != nil {
		return "", err
	}
	refreshToken := ""
	if scope == "user" {
		conn, err := findUserConnection(ctx, sess, connectorID, userID)
		if err != nil {
			return "", err
		}
		if conn == nil {
			return "", fmt.Errorf("google account not connected")
		}
		refreshToken, err = decryptNamedSecret(ctx, sess, conn.RefreshSecretID.String())
		if err != nil {
			return "", err
		}
	} else {
		if strings.TrimSpace(cfg.RefreshSecretID) == "" {
			return "", fmt.Errorf("google account not connected")
		}
		refreshToken, err = decryptNamedSecret(ctx, sess, cfg.RefreshSecretID)
		if err != nil {
			return "", err
		}
	}

	form := url.Values{}
	form.Set("grant_type", "refresh_token")
	form.Set("refresh_token", refreshToken)
	form.Set("client_id", cfg.ClientID)
	form.Set("client_secret", clientSecret)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.TokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("google token refresh failed: %w", err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}
	if res.StatusCode >= 400 {
		return "", fmt.Errorf("google token refresh returned %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}
	var parsed struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", err
	}
	if strings.TrimSpace(parsed.AccessToken) == "" {
		return "", fmt.Errorf("google token response missing access_token")
	}
	googleTokens.set(cacheKey, parsed.AccessToken, parsed.ExpiresIn)
	return parsed.AccessToken, nil
}

func googleAPIGet(ctx context.Context, accessToken, apiURL string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("google api returned %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}
	return body, nil
}

// GoogleSpreadsheetFile is a Drive spreadsheet entry.
type GoogleSpreadsheetFile struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// GoogleSheetTab is a worksheet tab inside a spreadsheet.
type GoogleSheetTab struct {
	Title string `json:"title"`
	Index int    `json:"index"`
}

// GoogleSheetPreview is header columns and sample rows.
type GoogleSheetPreview struct {
	Columns []string        `json:"columns"`
	Rows    [][]interface{} `json:"rows"`
}

// ListGoogleSpreadsheets lists spreadsheet files from Google Drive.
func (s *ConnectorService) ListGoogleSpreadsheets(ctx context.Context, tenantID, connectorID, userID uuid.UUID, query string, pageSize int) ([]GoogleSpreadsheetFile, error) {
	token, err := s.googleAccessToken(ctx, tenantID, connectorID, userID)
	if err != nil {
		return nil, err
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 50
	}
	q := url.QueryEscape("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false")
	if strings.TrimSpace(query) != "" {
		q = url.QueryEscape(fmt.Sprintf("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and name contains '%s'", strings.ReplaceAll(query, "'", "")))
	}
	apiURL := fmt.Sprintf(
		"https://www.googleapis.com/drive/v3/files?q=%s&pageSize=%d&fields=files(id,name)&orderBy=modifiedTime desc",
		q, pageSize,
	)
	body, err := googleAPIGet(ctx, token, apiURL)
	if err != nil {
		return nil, err
	}
	var parsed struct {
		Files []GoogleSpreadsheetFile `json:"files"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	return parsed.Files, nil
}

// ListGoogleSheets lists worksheet tabs for a spreadsheet.
func (s *ConnectorService) ListGoogleSheets(ctx context.Context, tenantID, connectorID, userID uuid.UUID, spreadsheetID string) ([]GoogleSheetTab, error) {
	token, err := s.googleAccessToken(ctx, tenantID, connectorID, userID)
	if err != nil {
		return nil, err
	}
	spreadsheetID = strings.TrimSpace(spreadsheetID)
	if spreadsheetID == "" {
		sess := s.store.WithTenant(ctx, tenantID)
		connector, err := sess.Connectors().GetByID(ctx, connectorID)
		if err != nil {
			return nil, err
		}
		cfg, err := parseAuthConfig(connector.AuthConfig)
		if err != nil {
			return nil, err
		}
		spreadsheetID = strings.TrimSpace(cfg.SpreadsheetID)
	}
	if spreadsheetID == "" {
		return nil, fmt.Errorf("spreadsheet_id is required")
	}
	apiURL := fmt.Sprintf("https://sheets.googleapis.com/v4/spreadsheets/%s?fields=sheets.properties", spreadsheetID)
	body, err := googleAPIGet(ctx, token, apiURL)
	if err != nil {
		return nil, err
	}
	var parsed struct {
		Sheets []struct {
			Properties struct {
				Title string `json:"title"`
				Index int    `json:"index"`
			} `json:"properties"`
		} `json:"sheets"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	out := make([]GoogleSheetTab, 0, len(parsed.Sheets))
	for _, sh := range parsed.Sheets {
		out = append(out, GoogleSheetTab{Title: sh.Properties.Title, Index: sh.Properties.Index})
	}
	return out, nil
}

// PreviewGoogleSheet returns header row and sample data rows.
func (s *ConnectorService) PreviewGoogleSheet(ctx context.Context, tenantID, connectorID, userID uuid.UUID, sheetName string, limit int) (*GoogleSheetPreview, error) {
	token, err := s.googleAccessToken(ctx, tenantID, connectorID, userID)
	if err != nil {
		return nil, err
	}
	sess := s.store.WithTenant(ctx, tenantID)
	connector, err := sess.Connectors().GetByID(ctx, connectorID)
	if err != nil {
		return nil, err
	}
	cfg, err := parseAuthConfig(connector.AuthConfig)
	if err != nil {
		return nil, err
	}
	spreadsheetID := strings.TrimSpace(cfg.SpreadsheetID)
	if spreadsheetID == "" {
		return nil, fmt.Errorf("spreadsheet_id is required")
	}
	if strings.TrimSpace(sheetName) == "" {
		sheetName = strings.TrimSpace(cfg.SheetName)
	}
	if sheetName == "" {
		return nil, fmt.Errorf("sheet name is required")
	}
	headerRow := cfg.HeaderRow
	if headerRow <= 0 {
		headerRow = 1
	}
	if limit <= 0 || limit > 20 {
		limit = 5
	}
	rangeStr := url.QueryEscape(fmt.Sprintf("'%s'!A%d:ZZ%d", sheetName, headerRow, headerRow+limit))
	apiURL := fmt.Sprintf("https://sheets.googleapis.com/v4/spreadsheets/%s/values/%s", spreadsheetID, rangeStr)
	body, err := googleAPIGet(ctx, token, apiURL)
	if err != nil {
		return nil, err
	}
	var parsed struct {
		Values [][]interface{} `json:"values"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	preview := &GoogleSheetPreview{Columns: []string{}, Rows: [][]interface{}{}}
	if len(parsed.Values) == 0 {
		return preview, nil
	}
	for _, cell := range parsed.Values[0] {
		preview.Columns = append(preview.Columns, fmt.Sprintf("%v", cell))
	}
	if len(parsed.Values) > 1 {
		preview.Rows = parsed.Values[1:]
	}
	return preview, nil
}
