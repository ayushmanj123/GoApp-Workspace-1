package api

import (
	"strings"

	"github.com/goapps-platform/metadata-service/internal/api/handlers"
	"github.com/goapps-platform/metadata-service/internal/api/tenant"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/metadata-service/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// RegisterRoutes registers API routes. middlewares run on /api/v1 (auth, etc.).
// Public webhook routes are registered without auth middlewares.
func RegisterRoutes(app *fiber.App, store repositories.Store, middlewares ...fiber.Handler) *services.WorkflowService {
	workflowHandler := handlers.NewWorkflowHandler(store)
	connectorHandler := handlers.NewConnectorHandler(store)

	public := app.Group("/api/v1/public")
	public.Post("/workflows/:id/hook", func(c *fiber.Ctx) error { return workflowHandler.PublicHook(c) })

	// Fiber Group middleware mounts as /api/v1* and would otherwise block Google's redirect.
	authed := make([]fiber.Handler, 0, len(middlewares))
	for _, mw := range middlewares {
		authed = append(authed, skipConnectorOAuthCallback(mw))
	}
	v1 := app.Group("/api/v1", authed...)

	// Public OAuth callback (auth skipped above). Must stay on this path — Google redirect URI.
	v1.Get("/connectors/oauth/callback", func(c *fiber.Ctx) error { return connectorHandler.OAuthCallback(c) })

	// Applications
	v1.Post("/applications", func(c *fiber.Ctx) error { return handlers.NewApplicationHandler(store).Create(c) })
	v1.Post("/applications/excel-app-scaffold", func(c *fiber.Ctx) error {
		return handlers.NewApplicationHandler(store).ExcelAppScaffold(c)
	})
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

	// Connectors
	v1.Post("/applications/:appId/connectors", func(c *fiber.Ctx) error { return connectorHandler.Create(c) })
	v1.Get("/applications/:appId/connectors", func(c *fiber.Ctx) error { return connectorHandler.List(c) })
	v1.Get("/connectors/:id", func(c *fiber.Ctx) error { return connectorHandler.Get(c) })
	v1.Put("/connectors/:id", func(c *fiber.Ctx) error { return connectorHandler.Update(c) })
	v1.Delete("/connectors/:id", func(c *fiber.Ctx) error { return connectorHandler.Delete(c) })
	v1.Post("/connectors/:id/oauth/start", func(c *fiber.Ctx) error { return connectorHandler.StartOAuth(c) })
	v1.Get("/connectors/:id/oauth/connection", func(c *fiber.Ctx) error { return connectorHandler.GetOAuthConnection(c) })
	v1.Delete("/connectors/:id/oauth/connection", func(c *fiber.Ctx) error { return connectorHandler.DeleteOAuthConnection(c) })
	v1.Get("/connectors/:id/google/files", func(c *fiber.Ctx) error { return connectorHandler.ListGoogleFiles(c) })
	v1.Get("/connectors/:id/google/sheets", func(c *fiber.Ctx) error { return connectorHandler.ListGoogleSheets(c) })
	v1.Get("/connectors/:id/google/preview", func(c *fiber.Ctx) error { return connectorHandler.PreviewGoogleSheet(c) })
	v1.Post("/connectors/:connectorId/actions", func(c *fiber.Ctx) error { return connectorHandler.CreateAction(c) })
	v1.Get("/connectors/:connectorId/actions", func(c *fiber.Ctx) error { return connectorHandler.ListActions(c) })
	v1.Put("/connector-actions/:id", func(c *fiber.Ctx) error { return connectorHandler.UpdateAction(c) })
	v1.Delete("/connector-actions/:id", func(c *fiber.Ctx) error { return connectorHandler.DeleteAction(c) })

	// Workflows (Phase 7.23 / 7.24)
	v1.Post("/applications/:appId/workflows", func(c *fiber.Ctx) error { return workflowHandler.Create(c) })
	v1.Get("/applications/:appId/workflows", func(c *fiber.Ctx) error { return workflowHandler.List(c) })
	v1.Get("/workflows/:id", func(c *fiber.Ctx) error { return workflowHandler.Get(c) })
	v1.Put("/workflows/:id", func(c *fiber.Ctx) error { return workflowHandler.Update(c) })
	v1.Delete("/workflows/:id", func(c *fiber.Ctx) error { return workflowHandler.Delete(c) })
	v1.Post("/workflows/:id/run", func(c *fiber.Ctx) error { return workflowHandler.Run(c) })
	v1.Get("/workflows/:id/runs", func(c *fiber.Ctx) error { return workflowHandler.ListRuns(c) })
	v1.Post("/workflows/:id/webhook-secret", func(c *fiber.Ctx) error { return workflowHandler.RotateWebhookSecret(c) })

	// Publishing (+ Enterprise ALM: unpublish / rollback / deprecate)
	publishHandler := handlers.NewPublishHandler(store)
	v1.Post("/applications/:id/publish", func(c *fiber.Ctx) error { return publishHandler.Publish(c) })
	v1.Post("/applications/:id/unpublish", func(c *fiber.Ctx) error { return publishHandler.Unpublish(c) })
	v1.Get("/applications/:id/versions", func(c *fiber.Ctx) error { return publishHandler.ListVersions(c) })
	v1.Get("/applications/:id/versions/:versionId", func(c *fiber.Ctx) error { return publishHandler.GetVersion(c) })
	v1.Post("/applications/:id/versions/:versionId/rollback", func(c *fiber.Ctx) error { return publishHandler.Rollback(c) })
	v1.Post("/applications/:id/versions/:versionId/deprecate", func(c *fiber.Ctx) error { return publishHandler.Deprecate(c) })

	// Environments (ALM: per-application dev/test/production promotion targets)
	envHandler := handlers.NewEnvironmentHandler(store)
	v1.Get("/applications/:appId/environments", func(c *fiber.Ctx) error { return envHandler.List(c) })
	v1.Post("/applications/:appId/environments", func(c *fiber.Ctx) error { return envHandler.Create(c) })
	v1.Get("/applications/:appId/environments/:envId", func(c *fiber.Ctx) error { return envHandler.Get(c) })
	v1.Put("/applications/:appId/environments/:envId", func(c *fiber.Ctx) error { return envHandler.Update(c) })
	v1.Delete("/applications/:appId/environments/:envId", func(c *fiber.Ctx) error { return envHandler.Delete(c) })
	v1.Post("/applications/:appId/environments/:envId/promote", func(c *fiber.Ctx) error { return envHandler.Promote(c) })
	v1.Get("/applications/:appId/environments/:envId/secret-overrides", func(c *fiber.Ctx) error {
		return envHandler.ListSecretOverrides(c)
	})
	v1.Put("/applications/:appId/environments/:envId/secret-overrides", func(c *fiber.Ctx) error {
		return envHandler.UpsertSecretOverride(c)
	})
	v1.Delete("/applications/:appId/environments/:envId/secret-overrides/:connectorId", func(c *fiber.Ctx) error {
		return envHandler.DeleteSecretOverride(c)
	})

	// Audit events (append-only ALM trail)
	auditHandler := handlers.NewAuditHandler(store)
	v1.Post("/audit-events", func(c *fiber.Ctx) error { return auditHandler.Create(c) })
	v1.Get("/audit-events", func(c *fiber.Ctx) error { return auditHandler.List(c) })

	// Solution packages (ALM references — distinct from publish artifact packages table)
	pkgHandler := handlers.NewSolutionPackageHandler(store)
	v1.Get("/packages", func(c *fiber.Ctx) error { return pkgHandler.List(c) })
	v1.Post("/packages", func(c *fiber.Ctx) error { return pkgHandler.Create(c) })
	v1.Get("/packages/:id", func(c *fiber.Ctx) error { return pkgHandler.Get(c) })
	v1.Put("/packages/:id", func(c *fiber.Ctx) error { return pkgHandler.Update(c) })
	v1.Delete("/packages/:id", func(c *fiber.Ctx) error { return pkgHandler.Delete(c) })
	v1.Get("/packages/:id/components", func(c *fiber.Ctx) error { return pkgHandler.ListComponents(c) })
	v1.Post("/packages/:id/components", func(c *fiber.Ctx) error { return pkgHandler.AddComponent(c) })
	v1.Delete("/packages/:id/components/:componentType/:componentId", func(c *fiber.Ctx) error {
		return pkgHandler.RemoveComponent(c)
	})

	return workflowHandler.Service()
}

// skipConnectorOAuthCallback lets Google's browser redirect reach the callback without JWT / X-Tenant-Id.
// Fiber mounts Group middleware as /api/v1*, so a separate app.Get is not enough.
func skipConnectorOAuthCallback(next fiber.Handler) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if c.Method() == fiber.MethodGet && strings.HasSuffix(c.Path(), "/connectors/oauth/callback") {
			return c.Next()
		}
		return next(c)
	}
}

// Helper to extract tenant id from Fiber context. It prefers Locals("tenant_id") then header.
// GetTenantID is retained for compatibility, but moved to the api/tenant helper.
func GetTenantID(c *fiber.Ctx) (uuid.UUID, error) {
	return tenant.GetTenantID(c)
}
