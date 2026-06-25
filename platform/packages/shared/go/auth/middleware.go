package auth

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const (
	headerAuthorization = "Authorization"
	headerTenantID      = "X-Tenant-Id"
	headerUserID        = "X-User-Id"
	headerUserEmail     = "X-User-Email"
	bearerPrefix        = "Bearer "
)

// Middleware authenticates requests and stores AuthContext.
func Middleware(cfg Config, validator TokenValidator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if authHeader := strings.TrimSpace(c.Get(headerAuthorization)); authHeader != "" {
			if !strings.HasPrefix(authHeader, bearerPrefix) {
				return unauthorized(c, "invalid authorization header")
			}
			token := strings.TrimSpace(strings.TrimPrefix(authHeader, bearerPrefix))
			if token == "" {
				return unauthorized(c, "missing bearer token")
			}
			ac, err := validator.Validate(c.UserContext(), token)
			if err != nil {
				return unauthorized(c, "invalid token")
			}
			SetFiberAuthContext(c, ac)
			return c.Next()
		}

		if cfg.IsDevelopment() {
			ac, err := developmentAuthContext(c, cfg)
			if err != nil {
				return unauthorized(c, err.Error())
			}
			SetFiberAuthContext(c, ac)
			return c.Next()
		}

		return unauthorized(c, "authentication required")
	}
}

func developmentAuthContext(c *fiber.Ctx, cfg Config) (*AuthContext, error) {
	tenantHeader := strings.TrimSpace(c.Get(headerTenantID))
	if tenantHeader == "" {
		return nil, ErrInvalidToken
	}
	tenantID, err := uuid.Parse(tenantHeader)
	if err != nil {
		return nil, ErrInvalidToken
	}

	userID, err := parseOptionalUUID(c.Get(headerUserID), cfg.DevDefaultUserID)
	if err != nil {
		return nil, ErrInvalidToken
	}

	email := strings.TrimSpace(c.Get(headerUserEmail))
	if email == "" {
		email = cfg.DevDefaultEmail
	}

	return &AuthContext{
		UserID:          userID,
		TenantID:        tenantID,
		Email:           email,
		Roles:           cfg.DevRoles(),
		IsAuthenticated: true,
	}, nil
}

func parseOptionalUUID(value, fallback string) (uuid.UUID, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		value = fallback
	}
	return uuid.Parse(value)
}

func unauthorized(c *fiber.Ctx, message string) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"success": false,
		"error":   message,
	})
}
