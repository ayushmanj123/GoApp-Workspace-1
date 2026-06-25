package api

import (
	"github.com/goapps-platform/metadata-service/internal/api/handlers"
	"github.com/goapps-platform/metadata-service/internal/api/tenant"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
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

	// Component definitions
	v1.Post("/applications/:appId/component-definitions", func(c *fiber.Ctx) error {
		return handlers.NewComponentDefinitionHandler(store).Create(c)
	})
	v1.Get("/applications/:appId/component-definitions", func(c *fiber.Ctx) error {
		return handlers.NewComponentDefinitionHandler(store).List(c)
	})
	v1.Get("/component-definitions/:id", func(c *fiber.Ctx) error {
		return handlers.NewComponentDefinitionHandler(store).Get(c)
	})

	// Entities
	v1.Post("/applications/:appId/entities", func(c *fiber.Ctx) error {
		return handlers.NewEntityHandler(store).Create(c)
	})
	v1.Get("/applications/:appId/entities", func(c *fiber.Ctx) error {
		return handlers.NewEntityHandler(store).List(c)
	})
	v1.Put("/entities/:id", func(c *fiber.Ctx) error {
		return handlers.NewEntityHandler(store).Update(c)
	})
	v1.Post("/entities/:entityId/fields", func(c *fiber.Ctx) error {
		return handlers.NewEntityHandler(store).CreateField(c)
	})
	v1.Get("/entities/:entityId/fields", func(c *fiber.Ctx) error {
		return handlers.NewEntityHandler(store).ListFields(c)
	})
	v1.Put("/entity-fields/:id", func(c *fiber.Ctx) error {
		return handlers.NewEntityHandler(store).UpdateField(c)
	})

	// Publishing
	publishHandler := handlers.NewPublishHandler(store)
	v1.Post("/applications/:id/publish", func(c *fiber.Ctx) error { return publishHandler.Publish(c) })
	v1.Get("/applications/:id/versions", func(c *fiber.Ctx) error { return publishHandler.ListVersions(c) })
	v1.Get("/applications/:id/versions/:versionId", func(c *fiber.Ctx) error { return publishHandler.GetVersion(c) })
}

// Helper to extract tenant id from Fiber context. It prefers Locals("tenant_id") then header.
// GetTenantID is retained for compatibility, but moved to the api/tenant helper.
func GetTenantID(c *fiber.Ctx) (uuid.UUID, error) {
	return tenant.GetTenantID(c)
}
