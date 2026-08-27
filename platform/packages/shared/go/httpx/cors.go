// Package httpx provides shared HTTP helpers for GoApps services.
package httpx

import (
	"os"
	"strings"

	"github.com/goapps-platform/shared/config"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

const defaultAllowHeaders = "Origin, Content-Type, Accept, Authorization, X-Tenant-Id, X-User-Id, X-User-Email, X-Request-ID"
const defaultAllowMethods = "GET, POST, PUT, PATCH, DELETE, OPTIONS"

// CORSConfig builds Fiber CORS settings from CORS_ALLOW_ORIGINS.
// Development defaults to "*". Production never defaults to wildcard;
// unset CORS_ALLOW_ORIGINS yields an empty allow-list (browser CORS denied).
func CORSConfig() cors.Config {
	origins := strings.TrimSpace(os.Getenv("CORS_ALLOW_ORIGINS"))
	if origins == "" {
		if config.IsProduction() {
			origins = ""
		} else {
			origins = "*"
		}
	}
	return cors.Config{
		AllowOrigins: origins,
		AllowHeaders: defaultAllowHeaders,
		AllowMethods: defaultAllowMethods,
	}
}
