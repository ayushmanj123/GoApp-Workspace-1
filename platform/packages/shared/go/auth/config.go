package auth

import (
	"fmt"
	"strings"

	"github.com/goapps-platform/shared/config"
)

const (
	ModeDevelopment = "development"
	ModeKeycloak    = "keycloak"
)

// Config holds authentication settings for platform services.
type Config struct {
	Mode             string `env:"AUTH_MODE" envDefault:"development"`
	KeycloakURL      string `env:"KEYCLOAK_URL"`
	KeycloakRealm    string `env:"KEYCLOAK_REALM"`
	KeycloakClientID string `env:"KEYCLOAK_CLIENT_ID"`
	KeycloakAudience string `env:"KEYCLOAK_AUDIENCE"`
	DevDefaultUserID string `env:"AUTH_DEV_DEFAULT_USER_ID" envDefault:"00000000-0000-4000-8000-000000000002"`
	DevDefaultEmail  string `env:"AUTH_DEV_DEFAULT_EMAIL" envDefault:"admin@development.local"`
	DevDefaultRoles  string `env:"AUTH_DEV_DEFAULT_ROLES" envDefault:"PlatformAdmin"`
}

// LoadConfig parses auth configuration from environment variables.
func LoadConfig() (Config, error) {
	var cfg Config
	if err := config.Load(&cfg); err != nil {
		return Config{}, err
	}
	return cfg, cfg.Validate()
}

// Validate ensures configuration is coherent for the selected auth mode.
func (c Config) Validate() error {
	mode := strings.ToLower(strings.TrimSpace(c.Mode))
	switch mode {
	case ModeDevelopment, ModeKeycloak:
		return nil
	default:
		return fmt.Errorf("auth: unsupported AUTH_MODE %q", c.Mode)
	}
}

// IsDevelopment reports whether development auth mode is active.
func (c Config) IsDevelopment() bool {
	return strings.EqualFold(strings.TrimSpace(c.Mode), ModeDevelopment)
}

// DevRoles splits configured development roles.
func (c Config) DevRoles() []string {
	parts := strings.Split(c.DevDefaultRoles, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		role := strings.TrimSpace(part)
		if role != "" {
			out = append(out, role)
		}
	}
	return out
}
