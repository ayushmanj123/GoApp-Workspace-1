package server

import (
	"github.com/goapps-platform/publish-service/internal/config"
	"github.com/goapps-platform/shared/server"
	"github.com/gofiber/fiber/v2"
)

func New(cfg config.Config) *fiber.App {
	logger := server.DefaultLogger(cfg.Base)
	return server.New(cfg.Base, logger)
}
