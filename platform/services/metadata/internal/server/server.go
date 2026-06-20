// Package server wires the metadata-service HTTP server.
package server

import (
	"github.com/goapps-platform/metadata-service/internal/api"
	"github.com/goapps-platform/metadata-service/internal/config"
	"github.com/goapps-platform/metadata-service/internal/database"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/shared/server"
	"github.com/gofiber/fiber/v2"
)

// New creates the metadata-service Fiber application.
func New(cfg config.Config) *fiber.App {
	logger := server.DefaultLogger(cfg.Base)
	app := server.New(cfg.Base, logger)

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
