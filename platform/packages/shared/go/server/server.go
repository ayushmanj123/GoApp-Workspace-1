// Package server provides a shared Fiber app factory for GoApps Platform services.
package server

import (
	"log/slog"

	"github.com/goapps-platform/shared/config"
	"github.com/goapps-platform/shared/health"
	"github.com/goapps-platform/shared/logging"
	"github.com/goapps-platform/shared/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

// New creates a Fiber application with standard middleware and health routes.
func New(cfg config.Base, logger *slog.Logger) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName:      cfg.ServiceName,
		ErrorHandler: middleware.ErrorHandler,
	})

	app.Use(recover.New())
	app.Use(middleware.RequestID())
	app.Use(middleware.RequestLogger(logger))

	// Health endpoints are registered before tenant middleware (public).
	health.Register(app, cfg.ServiceName)

	// Tenant extraction applies to subsequent routes added by the service.
	app.Use(middleware.Tenant())

	return app
}

// DefaultLogger creates a logger from base config.
func DefaultLogger(cfg config.Base) *slog.Logger {
	return logging.New(logging.Config{
		Level:   cfg.LogLevel,
		AppEnv:  cfg.AppEnv,
		Service: cfg.ServiceName,
	})
}
