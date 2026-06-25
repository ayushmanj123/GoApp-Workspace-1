package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

// ErrInvalidToken indicates the bearer token could not be validated.
var ErrInvalidToken = errors.New("invalid token")

// TokenValidator validates bearer tokens and returns normalized auth context.
type TokenValidator interface {
	Validate(ctx context.Context, token string) (*AuthContext, error)
}

// NewTokenValidator returns the validator for the configured auth mode.
func NewTokenValidator(cfg Config) (TokenValidator, error) {
	switch strings.ToLower(strings.TrimSpace(cfg.Mode)) {
	case ModeDevelopment:
		return NewDevTokenValidator(cfg), nil
	case ModeKeycloak:
		return NewKeycloakTokenValidator(cfg), nil
	default:
		return nil, fmt.Errorf("auth: unsupported AUTH_MODE %q", cfg.Mode)
	}
}

// DevTokenValidator validates development bearer tokens.
// Accepted format: dev:<tenant_uuid>:<user_uuid>[:email]
type DevTokenValidator struct {
	cfg Config
}

func NewDevTokenValidator(cfg Config) *DevTokenValidator {
	return &DevTokenValidator{cfg: cfg}
}

func (v *DevTokenValidator) Validate(_ context.Context, token string) (*AuthContext, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, ErrInvalidToken
	}
	if !strings.HasPrefix(token, "dev:") {
		return nil, ErrInvalidToken
	}

	parts := strings.Split(token, ":")
	if len(parts) < 3 {
		return nil, ErrInvalidToken
	}

	tenantID, err := uuid.Parse(parts[1])
	if err != nil {
		return nil, ErrInvalidToken
	}
	userID, err := uuid.Parse(parts[2])
	if err != nil {
		return nil, ErrInvalidToken
	}

	email := v.cfg.DevDefaultEmail
	if len(parts) >= 4 && strings.TrimSpace(parts[3]) != "" {
		email = strings.TrimSpace(parts[3])
	}

	return &AuthContext{
		UserID:          userID,
		TenantID:        tenantID,
		Email:           email,
		Roles:           v.cfg.DevRoles(),
		IsAuthenticated: true,
	}, nil
}

// KeycloakTokenValidator validates Keycloak-issued JWTs.
type KeycloakTokenValidator struct {
	cfg Config
}

func NewKeycloakTokenValidator(cfg Config) *KeycloakTokenValidator {
	return &KeycloakTokenValidator{cfg: cfg}
}

func (v *KeycloakTokenValidator) Validate(_ context.Context, _ string) (*AuthContext, error) {
	_ = v.cfg
	// TODO: implement Keycloak JWKS validation and claim extraction.
	return nil, fmt.Errorf("keycloak token validation not implemented")
}
