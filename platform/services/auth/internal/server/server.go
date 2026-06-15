// Package server wires the auth-service HTTP server.
package server

import (
	"github.com/goapps-platform/auth-service/internal/config"
	"github.com/goapps-platform/shared/server"
	"github.com/gofiber/fiber/v2"
)

// New creates the auth-service Fiber application.
func New(cfg config.Config) *fiber.App {
	logger := server.DefaultLogger(cfg.Base)
	return server.New(cfg.Base, logger)
}
