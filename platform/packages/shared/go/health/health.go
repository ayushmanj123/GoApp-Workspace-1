// Package health provides reusable health and readiness endpoints for GoApps Platform services.
package health

import (
	"github.com/goapps-platform/shared/response"
	"github.com/gofiber/fiber/v2"
)

// Status represents the health check payload.
type Status struct {
	Status  string `json:"status"`
	Service string `json:"service"`
}

// Register mounts liveness and readiness routes on the Fiber app.
// These routes are public and do not require tenant context.
func Register(app *fiber.App, serviceName string) {
	app.Get("/health", liveness(serviceName))
	app.Get("/ready", readiness(serviceName))
}

func liveness(serviceName string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		requestID, _ := c.Locals("requestID").(string)
		return c.JSON(response.OK(Status{
			Status:  "ok",
			Service: serviceName,
		}, requestID))
	}
}

func readiness(serviceName string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		requestID, _ := c.Locals("requestID").(string)
		// Foundation phase: always ready. Future: check DB, Redis, etc.
		return c.JSON(response.OK(Status{
			Status:  "ready",
			Service: serviceName,
		}, requestID))
	}
}
