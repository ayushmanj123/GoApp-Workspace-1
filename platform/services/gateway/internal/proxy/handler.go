package proxy

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/goapps-platform/shared/auth"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/proxy"
)

// Handler forwards authenticated gateway requests to upstream services.
type Handler struct {
	metadataBase string
	publishBase  string
	runtimeBase  string
}

func NewHandler(metadataBase, publishBase, runtimeBase string) *Handler {
	return &Handler{
		metadataBase: strings.TrimRight(metadataBase, "/"),
		publishBase:  strings.TrimRight(publishBase, "/"),
		runtimeBase:  strings.TrimRight(runtimeBase, "/"),
	}
}

// Forward routes the request to metadata or publish based on the path.
func (h *Handler) Forward(c *fiber.Ctx) error {
	ac, ok := auth.GetFiberAuthContext(c)
	if !ok || ac == nil || !ac.IsAuthenticated {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"error":   "authentication required",
		})
	}

	targetBase := h.metadataBase
	if isRuntimeRoute(c.Path()) {
		targetBase = h.runtimeBase
	} else if isPublishRoute(c.Path()) {
		targetBase = h.publishBase
	}

	targetURL, err := buildTargetURL(targetBase, c)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}

	c.Request().Header.Set("X-Tenant-Id", ac.TenantID.String())
	c.Request().Header.Set("X-User-Id", ac.UserID.String())
	if ac.Email != "" {
		c.Request().Header.Set("X-User-Email", ac.Email)
	}

	return proxy.Do(c, targetURL)
}

func isPublishRoute(path string) bool {
	return strings.Contains(path, "/publish") || strings.Contains(path, "/versions")
}

func isRuntimeRoute(path string) bool {
	return isRuntimeRecordRoute(path) || strings.HasPrefix(path, "/api/runtime/")
}

func isRuntimeRecordRoute(path string) bool {
	return strings.Contains(path, "/api/entities/") && strings.Contains(path, "/records")
}

func buildTargetURL(base string, c *fiber.Ctx) (string, error) {
	raw := base + c.OriginalURL()
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("proxy: invalid target url: %w", err)
	}
	return parsed.String(), nil
}
