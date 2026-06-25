package auth

import (
	"context"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const (
	testTenant = "00000000-0000-4000-8000-000000000001"
	testUser   = "00000000-0000-4000-8000-000000000002"
)

func testApp(cfg Config, validator TokenValidator) *fiber.App {
	app := fiber.New()
	app.Use(Middleware(cfg, validator))
	app.Get("/protected", RequireAuthenticated(), func(c *fiber.Ctx) error {
		ac, ok := GetFiberAuthContext(c)
		if !ok || ac == nil {
			return c.SendStatus(fiber.StatusInternalServerError)
		}
		return c.JSON(fiber.Map{
			"tenant_id":     ac.TenantID.String(),
			"user_id":       ac.UserID.String(),
			"email":         ac.Email,
			"roles":         ac.Roles,
			"authenticated": ac.IsAuthenticated,
		})
	})
	return app
}

func devConfig() Config {
	return Config{
		Mode:             ModeDevelopment,
		DevDefaultUserID: "00000000-0000-4000-8000-000000000002",
		DevDefaultEmail:  "admin@development.local",
		DevDefaultRoles:  "PlatformAdmin",
	}
}

func TestMiddlewareDevelopmentModeWithTenantHeader(t *testing.T) {
	cfg := devConfig()
	app := testApp(cfg, NewDevTokenValidator(cfg))

	req := httptest.NewRequest("GET", "/protected", nil)
	req.Header.Set("X-Tenant-Id", testTenant)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(body))
	}
}

func TestMiddlewareMissingTokenInDevelopment(t *testing.T) {
	cfg := devConfig()
	app := testApp(cfg, NewDevTokenValidator(cfg))

	req := httptest.NewRequest("GET", "/protected", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestMiddlewareInvalidBearerToken(t *testing.T) {
	cfg := devConfig()
	app := testApp(cfg, NewDevTokenValidator(cfg))

	req := httptest.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer not-a-valid-token")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestMiddlewareValidDevBearerToken(t *testing.T) {
	cfg := Config{Mode: ModeDevelopment, DevDefaultEmail: "dev@example.com", DevDefaultRoles: "PlatformAdmin"}
	app := testApp(cfg, NewDevTokenValidator(cfg))

	req := httptest.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer dev:"+testTenant+":"+testUser+":dev@example.com")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(body))
	}
}

func TestGetAuthContextPopulation(t *testing.T) {
	cfg := Config{Mode: ModeDevelopment}
	validator := NewDevTokenValidator(cfg)
	ac, err := validator.Validate(context.Background(), "dev:"+testTenant+":"+testUser)
	if err != nil {
		t.Fatalf("validate failed: %v", err)
	}
	if ac.TenantID != uuid.MustParse(testTenant) {
		t.Fatalf("unexpected tenant id")
	}
	if !ac.IsAuthenticated {
		t.Fatalf("expected authenticated context")
	}
}

func TestRequireRole(t *testing.T) {
	cfg := devConfig()
	cfg.DevDefaultRoles = "PlatformAdmin,Viewer"
	app := fiber.New()
	app.Use(Middleware(cfg, NewDevTokenValidator(cfg)))
	app.Get("/admin", RequireAuthenticated(), RequireRole("PlatformAdmin"), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})
	app.Get("/viewer", RequireAuthenticated(), RequireRole("MissingRole"), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	req := httptest.NewRequest("GET", "/admin", nil)
	req.Header.Set("X-Tenant-Id", testTenant)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	req2 := httptest.NewRequest("GET", "/viewer", nil)
	req2.Header.Set("X-Tenant-Id", testTenant)
	resp2, err := app.Test(req2)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp2.StatusCode != fiber.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp2.StatusCode)
	}
}

func TestKeycloakValidatorStub(t *testing.T) {
	cfg := Config{
		Mode:             ModeKeycloak,
		KeycloakURL:      "http://localhost:8080",
		KeycloakRealm:    "goapps",
		KeycloakClientID: "goapps-platform",
		KeycloakAudience: "goapps-platform",
	}
	validator := NewKeycloakTokenValidator(cfg)
	_, err := validator.Validate(context.Background(), "any-token")
	if err == nil {
		t.Fatalf("expected keycloak validator stub to fail")
	}
}
