// Package server wires the metadata-service HTTP server.
package server

import (
	"log/slog"

	"github.com/goapps-platform/metadata-service/internal/api"
	"github.com/goapps-platform/metadata-service/internal/config"
	"github.com/goapps-platform/metadata-service/internal/database"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/metadata-service/internal/services"
	"github.com/goapps-platform/shared/auth"
	"github.com/goapps-platform/shared/server"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

// New creates the metadata-service Fiber application.
func New(cfg config.Config) *fiber.App {
	logger := server.DefaultLogger(cfg.Base)
	app := server.New(cfg.Base, logger)

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, X-Tenant-Id, X-User-Id, X-User-Email, Authorization, X-Request-ID",
		AllowMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	}))

	db, err := database.Open(database.FromServiceConfig(cfg))
	if err != nil {
		logger.Error("metadata api routes disabled: database unavailable", "error", err.Error())
		return app
	}

	validator, err := auth.NewTokenValidator(cfg.Auth)
	if err != nil {
		logger.Error("metadata auth disabled: invalid AUTH config", slog.String("error", err.Error()))
		return app
	}

	store := repositories.NewGormStore(db)
	wfSvc := api.RegisterRoutes(
		app,
		store,
		auth.Middleware(cfg.Auth, validator),
		auth.RequireAuthenticated(),
		syncAuthLocals,
	)

	if cfg.WorkflowSchedulerEnabled && wfSvc != nil {
		scheduler := services.NewWorkflowScheduler(store, wfSvc, logger)
		scheduler.Start()
		logger.Info("workflow scheduler started")
	}

	return app
}

func syncAuthLocals(c *fiber.Ctx) error {
	if ac, ok := auth.GetFiberAuthContext(c); ok && ac != nil {
		c.Locals("tenant_id", ac.TenantID)
		c.Locals("user_id", ac.UserID)
	}
	return c.Next()
}
