package auth

import (
	"context"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type contextKey struct{}

// AuthContext carries authenticated identity for platform requests.
type AuthContext struct {
	UserID          uuid.UUID
	TenantID        uuid.UUID
	Email           string
	Roles           []string
	IsAuthenticated bool
}

const fiberAuthContextKey = "authContext"

// WithContext stores AuthContext in a standard context.Context.
func WithContext(ctx context.Context, ac *AuthContext) context.Context {
	return context.WithValue(ctx, contextKey{}, ac)
}

// GetAuthContext reads AuthContext from context.Context.
func GetAuthContext(ctx context.Context) (*AuthContext, bool) {
	if ac, ok := ctx.Value(contextKey{}).(*AuthContext); ok && ac != nil {
		return ac, true
	}
	return nil, false
}

// GetFiberAuthContext reads AuthContext from a Fiber request context.
func GetFiberAuthContext(c *fiber.Ctx) (*AuthContext, bool) {
	if v := c.Locals(fiberAuthContextKey); v != nil {
		if ac, ok := v.(*AuthContext); ok && ac != nil {
			return ac, true
		}
	}
	return GetAuthContext(c.UserContext())
}

// SetFiberAuthContext stores AuthContext on Fiber locals and user context.
func SetFiberAuthContext(c *fiber.Ctx, ac *AuthContext) {
	c.Locals(fiberAuthContextKey, ac)
	c.SetUserContext(WithContext(c.UserContext(), ac))
}

// RequireAuthenticated rejects unauthenticated requests.
func RequireAuthenticated() fiber.Handler {
	return func(c *fiber.Ctx) error {
		ac, ok := GetFiberAuthContext(c)
		if !ok || ac == nil || !ac.IsAuthenticated {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"error":   "authentication required",
			})
		}
		return c.Next()
	}
}

// RequireRole rejects requests that do not include the given role.
func RequireRole(role string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ac, ok := GetFiberAuthContext(c)
		if !ok || ac == nil || !ac.IsAuthenticated {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"error":   "authentication required",
			})
		}
		for _, r := range ac.Roles {
			if r == role {
				return c.Next()
			}
		}
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"error":   "insufficient role",
		})
	}
}

// AuthContextFromClaims builds AuthContext from validated claims.
func AuthContextFromClaims(claims *Claims) (*AuthContext, error) {
	if claims == nil {
		return nil, ErrInvalidToken
	}
	tenantID, err := uuid.Parse(claims.TenantID)
	if err != nil {
		return nil, ErrInvalidToken
	}
	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return nil, ErrInvalidToken
	}
	return &AuthContext{
		UserID:          userID,
		TenantID:        tenantID,
		Email:           claims.Email,
		Roles:           append([]string(nil), claims.Roles...),
		IsAuthenticated: true,
	}, nil
}
