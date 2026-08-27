package services

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

const (
	googleAuthURL  = "https://accounts.google.com/o/oauth2/v2/auth"
	googleTokenURL = "https://oauth2.googleapis.com/token"
	googleSheetsScope = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly"
)

func googleOAuthClientID() string {
	return strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_CLIENT_ID"))
}

func googleOAuthClientSecret() string {
	return strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET"))
}

// mergeGoogleSheetsOAuthDefaults fills OAuth fields from environment when creating
// or updating google_sheets connectors.
func mergeGoogleSheetsOAuthDefaults(raw []byte) ([]byte, error) {
	cfg, err := parseAuthConfig(raw)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(cfg.AuthorizationURL) == "" {
		cfg.AuthorizationURL = googleAuthURL
	}
	if strings.TrimSpace(cfg.TokenURL) == "" {
		cfg.TokenURL = googleTokenURL
	}
	if strings.TrimSpace(cfg.ClientID) == "" {
		cfg.ClientID = googleOAuthClientID()
	}
	if strings.TrimSpace(cfg.Scope) == "" {
		cfg.Scope = googleSheetsScope
	}
	if strings.TrimSpace(cfg.Type) == "" {
		cfg.Type = "oauth_authorization_code"
	}
	if cfg.ConnectionScope == "" {
		cfg.ConnectionScope = "user"
	}
	if cfg.HeaderRow <= 0 {
		cfg.HeaderRow = 1
	}
	if cfg.ClientSecret == "" {
		cfg.ClientSecret = googleOAuthClientSecret()
	}
	if strings.TrimSpace(cfg.ClientID) == "" || strings.TrimSpace(cfg.ClientSecret) == "" {
		return nil, fmt.Errorf("GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set in platform/.env (see docs/google-sheets-connectors.md)")
	}
	out, err := json.Marshal(cfg)
	if err != nil {
		return nil, err
	}
	return out, nil
}
