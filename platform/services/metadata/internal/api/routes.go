package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/goapps-platform/metadata-service/internal/api/handlers"
	"github.com/goapps-platform/metadata-service/internal/repositories"
)

// RegisterRoutes registers API routes. jwtMiddleware is passed in to allow using existing middleware.
func RegisterRoutes(app *fiber.App, store repositories.Store, jwtMiddleware fiber.Handler) {
	v1 := app.Group("/api/v1", jwtMiddleware)

	// Applications
	v1.Post("/applications", func(c *fiber.Ctx) error { return handlers.NewApplicationHandler(store).Create(c) })
	v1.Get("/applications", func(c *fiber.Ctx) error { return handlers.NewApplicationHandler(store).List(c) })
	v1.Get("/applications/:id", func(c *fiber.Ctx) error { return handlers.NewApplicationHandler(store).Get(c) })
	v1.Put("/applications/:id", func(c *fiber.Ctx) error { return handlers.NewApplicationHandler(store).Update(c) })
	v1.Delete("/applications/:id", func(c *fiber.Ctx) error { return handlers.NewApplicationHandler(store).Delete(c) })

	// Screens
	v1.Post("/applications/:appId/screens", func(c *fiber.Ctx) error { return handlers.NewScreenHandler(store).Create(c) })
	v1.Get("/applications/:appId/screens", func(c *fiber.Ctx) error { return handlers.NewScreenHandler(store).List(c) })
	v1.Put("/screens/:id", func(c *fiber.Ctx) error { return handlers.NewScreenHandler(store).Update(c) })
	v1.Delete("/screens/:id", func(c *fiber.Ctx) error { return handlers.NewScreenHandler(store).Delete(c) })

	// Controls
	v1.Post("/screens/:screenId/controls", func(c *fiber.Ctx) error { return handlers.NewControlHandler(store).Create(c) })
	v1.Get("/screens/:screenId/controls", func(c *fiber.Ctx) error { return handlers.NewControlHandler(store).List(c) })
	v1.Put("/controls/:id", func(c *fiber.Ctx) error { return handlers.NewControlHandler(store).Update(c) })
	v1.Delete("/controls/:id", func(c *fiber.Ctx) error { return handlers.NewControlHandler(store).Delete(c) })

	// Properties
	v1.Put("/controls/:id/properties", func(c *fiber.Ctx) error { return handlers.NewPropertyHandler(store).Update(c) })
	v1.Get("/controls/:id/properties", func(c *fiber.Ctx) error { return handlers.NewPropertyHandler(store).Get(c) })

	// Formulas
	v1.Post("/controls/:id/formulas", func(c *fiber.Ctx) error { return handlers.NewFormulaHandler(store).Create(c) })
	v1.Get("/controls/:id/formulas", func(c *fiber.Ctx) error { return handlers.NewFormulaHandler(store).List(c) })
	v1.Put("/formulas/:id", func(c *fiber.Ctx) error { return handlers.NewFormulaHandler(store).Update(c) })
	v1.Delete("/formulas/:id", func(c *fiber.Ctx) error { return handlers.NewFormulaHandler(store).Delete(c) })

	// Runtime endpoints
	v1.Get("/runtime/applications/:id", func(c *fiber.Ctx) error { return handlers.NewRuntimeHandler(store).GetApplication(c) })
	v1.Get("/runtime/applications/:id/screens", func(c *fiber.Ctx) error { return handlers.NewRuntimeHandler(store).GetApplicationScreens(c) })
	v1.Get("/runtime/screens/:id", func(c *fiber.Ctx) error { return handlers.NewRuntimeHandler(store).GetScreen(c) })
	v1.Get("/runtime/screens/:id/tree", func(c *fiber.Ctx) error { return handlers.NewRuntimeHandler(store).GetScreenTree(c) })
}

// Helper to extract tenant id from Fiber context. It prefers Locals("tenant_id") then header.
func GetTenantID(c *fiber.Ctx) (uuid.UUID, error) {
	if v := c.Locals("tenant_id"); v != nil {
		switch t := v.(type) {
		case uuid.UUID:
			return t, nil
		case string:
			return uuid.Parse(t)
		}
	}
	// fallback header
	if hs := c.Get("X-Tenant-Id"); hs != "" {
		return uuid.Parse(hs)
	}
	return uuid.Nil, fiber.ErrUnauthorized
}
