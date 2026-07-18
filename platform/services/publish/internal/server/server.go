package server

import (
	"log/slog"

	"github.com/goapps-platform/publish-service/internal/client"
	"github.com/goapps-platform/publish-service/internal/config"
	"github.com/goapps-platform/publish-service/internal/handlers"
	"github.com/goapps-platform/shared/auth"
	"github.com/goapps-platform/shared/server"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func New(cfg config.Config) *fiber.App {
	logger := server.DefaultLogger(cfg.Base)
	app := server.New(cfg.Base, logger)

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, X-Tenant-Id, X-User-Id, X-User-Email, Authorization, X-Request-ID",
		AllowMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	}))

	validator, err := auth.NewTokenValidator(cfg.Auth)
	if err != nil {
		logger.Error("publish auth disabled: invalid AUTH config", slog.String("error", err.Error()))
		return app
	}

	metadata := client.NewMetadataClient(cfg.MetadataServiceURL)
	publishHandler := handlers.NewPublishHandler(metadata)

	v1 := app.Group(
		"/api/v1",
		auth.Middleware(cfg.Auth, validator),
		auth.RequireAuthenticated(),
	)
	v1.Post("/applications/:id/publish", publishHandler.Publish)
	v1.Post("/applications/:id/unpublish", publishHandler.Unpublish)
	v1.Get("/applications/:id/versions", publishHandler.ListVersions)
	v1.Get("/applications/:id/versions/:versionId", publishHandler.GetVersion)
	v1.Post("/applications/:id/versions/:versionId/rollback", publishHandler.Rollback)
	v1.Post("/applications/:id/versions/:versionId/deprecate", publishHandler.Deprecate)

	return app
}
