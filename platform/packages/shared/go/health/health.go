// Package health provides reusable health and readiness endpoints for GoApps Platform services.
package health

import (
	"fmt"
	"net/http"

	"github.com/goapps-platform/shared/errors"
	"github.com/goapps-platform/shared/response"
	"github.com/gofiber/fiber/v2"
)

// Status represents the health check payload.
type Status struct {
	Status     string            `json:"status"`
	Service    string            `json:"service"`
	Components map[string]string `json:"components,omitempty"`
}

// Checker verifies an individual dependency for readiness probes.
type Checker interface {
	Name() string
	Check(c *fiber.Ctx) error
}

// Register mounts liveness and readiness routes on the Fiber app.
// These routes are public and do not require tenant context.
func Register(app *fiber.App, serviceName string) {
	RegisterWithChecks(app, serviceName, nil)
}

// RegisterWithChecks mounts health endpoints with optional dependency checks.
func RegisterWithChecks(app *fiber.App, serviceName string, checkers []Checker) {
	app.Get("/health", liveness(serviceName))
	app.Get("/ready", readiness(serviceName, checkers))
	app.Get("/readiness", readiness(serviceName, checkers))
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

func readiness(serviceName string, checkers []Checker) fiber.Handler {
	return func(c *fiber.Ctx) error {
		requestID, _ := c.Locals("requestID").(string)
		components := map[string]string{}
		for _, checker := range checkers {
			if checker == nil {
				continue
			}
			if err := checker.Check(c); err != nil {
				components[checker.Name()] = "down"
				return c.Status(http.StatusServiceUnavailable).JSON(response.FromAppError(
					errors.New("SERVICE_UNAVAILABLE", fmt.Sprintf("%s is unavailable", checker.Name()), http.StatusServiceUnavailable).
						WithCorrelationID(requestID),
					requestID,
				))
			}
			components[checker.Name()] = "ok"
		}
		status := Status{
			Status:  "ready",
			Service: serviceName,
		}
		if len(components) > 0 {
			status.Components = components
		}
		return c.JSON(response.OK(status, requestID))
	}
}
