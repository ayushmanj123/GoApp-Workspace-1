package server

import (
	"github.com/goapps-platform/publish-service/internal/client"
	"github.com/goapps-platform/publish-service/internal/config"
	"github.com/goapps-platform/publish-service/internal/handlers"
	"github.com/goapps-platform/shared/server"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func New(cfg config.Config) *fiber.App {
	logger := server.DefaultLogger(cfg.Base)
	app := server.New(cfg.Base, logger)

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, X-Tenant-Id, Authorization, X-Request-ID",
		AllowMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	}))

	metadata := client.NewMetadataClient(cfg.MetadataServiceURL)
	publishHandler := handlers.NewPublishHandler(metadata)

	v1 := app.Group("/api/v1")
	v1.Post("/applications/:id/publish", publishHandler.Publish)
	v1.Get("/applications/:id/versions", publishHandler.ListVersions)
	v1.Get("/applications/:id/versions/:versionId", publishHandler.GetVersion)

	return app
}
