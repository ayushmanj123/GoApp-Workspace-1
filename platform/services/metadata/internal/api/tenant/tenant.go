package tenant

import (
	"github.com/goapps-platform/shared/auth"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// GetTenantID extracts tenant id preferring AuthContext, then locals, then header.
// In keycloak mode the auth middleware populates AuthContext; client-supplied
// headers alone are insufficient because middleware rejects unauthenticated requests.
func GetTenantID(c *fiber.Ctx) (uuid.UUID, error) {
	if ac, ok := auth.GetFiberAuthContext(c); ok && ac != nil && ac.IsAuthenticated {
		return ac.TenantID, nil
	}
	if v := c.Locals("tenant_id"); v != nil {
		switch t := v.(type) {
		case uuid.UUID:
			return t, nil
		case string:
			return uuid.Parse(t)
		}
	}
	if hs := c.Get("X-Tenant-Id"); hs != "" {
		return uuid.Parse(hs)
	}
	return uuid.Nil, fiber.ErrUnauthorized
}

// GetUserID extracts the acting user id for audit trails.
func GetUserID(c *fiber.Ctx) *uuid.UUID {
	if ac, ok := auth.GetFiberAuthContext(c); ok && ac != nil && ac.IsAuthenticated {
		id := ac.UserID
		return &id
	}
	if v := c.Locals("user_id"); v != nil {
		switch t := v.(type) {
		case uuid.UUID:
			return &t
		case string:
			if id, err := uuid.Parse(t); err == nil {
				return &id
			}
		}
	}
	if hs := c.Get("X-User-Id"); hs != "" {
		if id, err := uuid.Parse(hs); err == nil {
			return &id
		}
	}
	return nil
}
