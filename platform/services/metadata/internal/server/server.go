// Package server wires the metadata-service HTTP server.
package server

import (
	"fmt"
	"log/slog"

	"github.com/goapps-platform/metadata-service/internal/api"
	"github.com/goapps-platform/metadata-service/internal/config"
	"github.com/goapps-platform/metadata-service/internal/database"
	metahealth "github.com/goapps-platform/metadata-service/internal/health"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/metadata-service/internal/services"
	"github.com/goapps-platform/shared/auth"
	"github.com/goapps-platform/shared/health"
	"github.com/goapps-platform/shared/httpx"
	"github.com/goapps-platform/shared/logging"
	"github.com/goapps-platform/shared/metrics"
	"github.com/goapps-platform/shared/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

// New creates the metadata-service Fiber application.
// Returns an error when the database or auth configuration is unavailable
// (fail-closed; no health-only zombie process).
func New(cfg config.Config) (*fiber.App, error) {
	logger := logging.New(logging.Config{
		Level:   cfg.LogLevel,
		AppEnv:  cfg.AppEnv,
		Service: cfg.ServiceName,
	})

	validator, err := auth.NewTokenValidator(cfg.Auth)
	if err != nil {
		return nil, fmt.Errorf("metadata: auth config: %w", err)
	}

	db, err := database.Open(database.FromServiceConfig(cfg))
	if err != nil {
		return nil, fmt.Errorf("metadata: database: %w", err)
	}

	app := fiber.New(fiber.Config{
		AppName:      cfg.ServiceName,
		ErrorHandler: middleware.ErrorHandler,
	})
	app.Use(recover.New())
	app.Use(middleware.RequestID())
	app.Use(metrics.HTTPMiddleware(cfg.ServiceName))
	metrics.RegisterMetrics(app)
	app.Use(middleware.RequestLogger(logger))
	app.Use(cors.New(httpx.CORSConfig()))

	health.RegisterWithChecks(app, cfg.ServiceName, []health.Checker{
		metahealth.DatabaseChecker{DB: db},
	})
	app.Use(middleware.Tenant())

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

	return app, nil
}

func syncAuthLocals(c *fiber.Ctx) error {
	if ac, ok := auth.GetFiberAuthContext(c); ok && ac != nil {
		c.Locals("tenant_id", ac.TenantID)
		c.Locals("user_id", ac.UserID)
	}
	return c.Next()
}

// DefaultLogger creates a logger from metadata config (tests / helpers).
func DefaultLogger(cfg config.Config) *slog.Logger {
	return logging.New(logging.Config{
		Level:   cfg.LogLevel,
		AppEnv:  cfg.AppEnv,
		Service: cfg.ServiceName,
	})
}
