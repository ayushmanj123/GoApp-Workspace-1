package server

import (
	"fmt"
	"log/slog"

	"github.com/goapps-platform/publish-service/internal/client"
	"github.com/goapps-platform/publish-service/internal/config"
	"github.com/goapps-platform/publish-service/internal/handlers"
	"github.com/goapps-platform/shared/auth"
	"github.com/goapps-platform/shared/httpx"
	"github.com/goapps-platform/shared/logging"
	"github.com/goapps-platform/shared/server"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

// New creates the publish-service Fiber application.
// Returns an error when auth configuration is invalid (fail-closed).
func New(cfg config.Config) (*fiber.App, error) {
	logger := server.DefaultLogger(cfg.Base)

	validator, err := auth.NewTokenValidator(cfg.Auth)
	if err != nil {
		return nil, fmt.Errorf("publish: auth config: %w", err)
	}

	app := server.New(cfg.Base, logger)
	app.Use(cors.New(httpx.CORSConfig()))

	metadata := client.NewMetadataClient(cfg.MetadataServiceURL)
	publishHandler := handlers.NewPublishHandler(metadata)

	v1 := app.Group(
		"/api/v1",
		auth.Middleware(cfg.Auth, validator),
		auth.RequireAuthenticated(),
	)
	admin := auth.RequireRole(auth.RolePlatformAdmin)
	v1.Post("/applications/:id/publish", admin, publishHandler.Publish)
	v1.Post("/applications/:id/unpublish", admin, publishHandler.Unpublish)
	v1.Get("/applications/:id/versions", publishHandler.ListVersions)
	v1.Get("/applications/:id/versions/:versionId", publishHandler.GetVersion)
	v1.Post("/applications/:id/versions/:versionId/rollback", admin, publishHandler.Rollback)
	v1.Post("/applications/:id/versions/:versionId/deprecate", admin, publishHandler.Deprecate)

	return app, nil
}

// DefaultLogger creates a logger from publish config.
func DefaultLogger(cfg config.Config) *slog.Logger {
	return logging.New(logging.Config{
		Level:   cfg.LogLevel,
		AppEnv:  cfg.AppEnv,
		Service: cfg.ServiceName,
	})
}
