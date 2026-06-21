// Package server wires the metadata-service HTTP server.
package server

import (
	"github.com/goapps-platform/metadata-service/internal/api"
	"github.com/goapps-platform/metadata-service/internal/config"
	"github.com/goapps-platform/metadata-service/internal/database"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/shared/server"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

// New creates the metadata-service Fiber application.
func New(cfg config.Config) *fiber.App {
	logger := server.DefaultLogger(cfg.Base)
	app := server.New(cfg.Base, logger)

	// Allow browser clients (Studio, Runtime) to call the API during development.
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, X-Tenant-Id, Authorization, X-Request-ID",
		AllowMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	}))

	db, err := database.Open(database.FromServiceConfig(cfg))
	if err != nil {
		logger.Error("metadata api routes disabled: database unavailable", "error", err.Error())
		return app
	}

	// TODO: replace with JWT middleware once auth integration is wired.
	jwtPassthrough := func(c *fiber.Ctx) error { return c.Next() }
	store := repositories.NewGormStore(db)
	api.RegisterRoutes(app, store, jwtPassthrough)
	return app
}
