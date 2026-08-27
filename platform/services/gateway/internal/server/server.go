// Package server wires the gateway-service HTTP server.
package server

import (
	"log/slog"
	"time"

	"github.com/goapps-platform/gateway-service/internal/config"
	"github.com/goapps-platform/gateway-service/internal/proxy"
	"github.com/goapps-platform/shared/auth"
	"github.com/goapps-platform/shared/health"
	"github.com/goapps-platform/shared/httpx"
	"github.com/goapps-platform/shared/logging"
	"github.com/goapps-platform/shared/metrics"
	"github.com/goapps-platform/shared/middleware"
	"github.com/goapps-platform/shared/response"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

// New creates the gateway-service Fiber application.
func New(cfg config.Config) (*fiber.App, error) {
	logger := logging.New(logging.Config{
		Level:   cfg.LogLevel,
		AppEnv:  cfg.AppEnv,
		Service: cfg.ServiceName,
	})

	validator, err := auth.NewTokenValidator(cfg.Auth)
	if err != nil {
		return nil, err
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

	registerPublicRoutes(app, cfg.ServiceName)

	authMiddleware := auth.Middleware(cfg.Auth, validator)
	proxyHandler := proxy.NewHandler(cfg.MetadataServiceURL, cfg.PublishServiceURL, cfg.RuntimeServiceURL)

	publicLimit := limiter.New(limiter.Config{
		Max:        60,
		Expiration: time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP() + ":" + c.Path()
		},
	})

	// Public workflow webhooks (no Keycloak) — must be registered before the authed /api group.
	app.All("/api/v1/public/*", publicLimit, proxyHandler.ForwardPublic)
	// Public connector OAuth callback — Google redirects here without auth headers.
	app.Get("/api/v1/connectors/oauth/callback", proxyHandler.ForwardPublic)

	api := app.Group("/api", authMiddleware, auth.RequireAuthenticated())
	api.All("/*", proxyHandler.Forward)

	return app, nil
}

func registerPublicRoutes(app *fiber.App, serviceName string) {
	health.Register(app, serviceName)
	app.Get("/live", liveness(serviceName))
}

func liveness(serviceName string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		requestID, _ := c.Locals("requestID").(string)
		return c.JSON(response.OK(health.Status{
			Status:  "live",
			Service: serviceName,
		}, requestID))
	}
}

// DefaultLogger creates a logger from gateway config.
func DefaultLogger(cfg config.Config) *slog.Logger {
	return logging.New(logging.Config{
		Level:   cfg.LogLevel,
		AppEnv:  cfg.AppEnv,
		Service: cfg.ServiceName,
	})
}
