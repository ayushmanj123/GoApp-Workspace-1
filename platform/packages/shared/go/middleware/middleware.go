// Package middleware provides Fiber middleware for GoApps Platform services.
package middleware

import (
	"log/slog"
	"runtime/debug"
	"strings"
	"time"

	"github.com/goapps-platform/shared/errors"
	"github.com/goapps-platform/shared/logging"
	"github.com/goapps-platform/shared/response"
	"github.com/goapps-platform/shared/tenant"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const requestIDHeader = "X-Request-ID"

// RequestID injects a unique request ID into each request context.
func RequestID() fiber.Handler {
	return func(c *fiber.Ctx) error {
		requestID := c.Get(requestIDHeader)
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set(requestIDHeader, requestID)
		c.Locals("requestID", requestID)
		return c.Next()
	}
}

// RequestLogger attaches a request-scoped logger and logs completed requests.
func RequestLogger(base *slog.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		requestID, _ := c.Locals("requestID").(string)
		reqLogger := base.With(slog.String("request_id", requestID))
		ctx := logging.WithContext(c.UserContext(), reqLogger)
		c.SetUserContext(ctx)

		start := time.Now()
		err := c.Next()

		fields := []any{
			slog.String("method", c.Method()),
			slog.String("path", c.Path()),
			slog.Int("status", c.Response().StatusCode()),
			slog.Int64("duration_ms", time.Since(start).Milliseconds()),
		}
		if sessionID := c.Params("sessionId"); sessionID != "" {
			fields = append(fields, slog.String("session_id", sessionID))
		}
		if screenID := c.Params("screenId"); screenID != "" {
			fields = append(fields, slog.String("screen_id", screenID))
		}
		if controlID := c.Params("controlId"); controlID != "" {
			fields = append(fields, slog.String("control_id", controlID))
		}
		if tenantID := c.Get(tenant.HeaderTenantID); tenantID != "" {
			fields = append(fields, slog.String("tenant_id", tenantID))
		}
		if userID := c.Get(tenant.HeaderUserID); userID != "" {
			fields = append(fields, slog.String("user_id", userID))
		}
		if appID, ok := c.Locals("appId").(string); ok && appID != "" {
			fields = append(fields, slog.String("app_id", appID))
		}

		reqLogger.Info("request completed", fields...)
		return err
	}
}

// Tenant extracts tenant context from headers. Does not enforce tenant presence;
// use RequireTenant on protected route groups.
func Tenant() fiber.Handler {
	return func(c *fiber.Ctx) error {
		requestID, _ := c.Locals("requestID").(string)

		tc := &tenant.Context{
			TenantID:       c.Get(tenant.HeaderTenantID),
			UserID:         c.Get(tenant.HeaderUserID),
			OrganizationID: c.Get(tenant.HeaderOrganizationID),
			RequestID:      requestID,
		}

		// Future: extract claims from Authorization Bearer JWT via Keycloak.
		// Foundation phase reads headers only; values come from the caller.

		ctx := tenant.WithContext(c.UserContext(), tc)
		c.SetUserContext(ctx)
		return c.Next()
	}
}

// RequireTenant rejects requests that lack a tenant ID on protected routes.
func RequireTenant() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !tenant.HasTenantID(c.UserContext()) {
			requestID, _ := c.Locals("requestID").(string)
			return c.Status(fiber.StatusUnauthorized).JSON(
				response.Fail(errors.Unauthorized("tenant context required").Code,
					"tenant context required", requestID),
			)
		}
		return c.Next()
	}
}

// ErrorHandler is the global Fiber error handler using the shared response format.
func ErrorHandler(c *fiber.Ctx, err error) error {
	requestID, _ := c.Locals("requestID").(string)
	logger := logging.FromContext(c.UserContext())
	if logger == nil {
		logger = slog.Default()
	}

	if appErr := errors.AsAppError(err); appErr != nil {
		safe := errors.Sanitize(appErr, requestID)
		logger.Error("application error",
			slog.String("error", err.Error()),
			slog.String("app_error_code", safe.Code),
			slog.String("request_id", requestID),
		)
		return c.Status(safe.HTTPStatus).JSON(response.FromAppError(safe, requestID))
	}

	if err == fiber.ErrNotFound {
		logger.Error("resource not found",
			slog.String("error", err.Error()),
			slog.String("request_id", requestID),
		)
		return c.Status(fiber.StatusNotFound).JSON(
			response.Fail("NOT_FOUND", "resource not found", requestID),
		)
	}

	status := fiber.StatusInternalServerError
	if fe, ok := err.(*fiber.Error); ok {
		status = fe.Code
		message := fe.Message
		if message == "" {
			message = "request failed"
		}
		logger.Error("fiber error",
			slog.String("error", err.Error()),
			slog.String("request_id", requestID),
		)
		code := "INTERNAL_ERROR"
		switch status {
		case fiber.StatusBadRequest:
			code = "BAD_REQUEST"
		case fiber.StatusUnauthorized:
			code = "UNAUTHORIZED"
		case fiber.StatusForbidden:
			code = "FORBIDDEN"
		case fiber.StatusNotFound:
			code = "NOT_FOUND"
		case fiber.StatusConflict:
			code = "CONFLICT"
		}
		if status >= fiber.StatusInternalServerError {
			message = "internal server error"
		}
		return c.Status(status).JSON(response.Fail(code, message, requestID))
	}

	message := "internal server error"
	if strings.EqualFold(c.App().Config().AppName, "development") {
		message = err.Error()
	}

	logger.Error("unhandled error",
		slog.String("error", err.Error()),
		slog.String("request_id", requestID),
		slog.String("stack", string(debug.Stack())),
	)

	return c.Status(status).JSON(
		response.Fail("INTERNAL_ERROR", message, requestID),
	)
}
