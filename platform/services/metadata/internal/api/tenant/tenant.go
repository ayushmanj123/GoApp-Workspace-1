package tenant

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// GetTenantID extracts tenant id from Fiber context, preferring locals over header.
func GetTenantID(c *fiber.Ctx) (uuid.UUID, error) {
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
