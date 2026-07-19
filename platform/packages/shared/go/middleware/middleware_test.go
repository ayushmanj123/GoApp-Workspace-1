package middleware

import (
	"io"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestRequestIDStampsInboundWhenMissing(t *testing.T) {
	app := fiber.New()
	app.Use(RequestID())
	app.Get("/ping", func(c *fiber.Ctx) error {
		inbound := string(c.Request().Header.Peek("X-Request-ID"))
		if inbound == "" {
			t.Fatal("expected inbound X-Request-ID to be stamped")
		}
		return c.SendString(inbound)
	})

	req := httptest.NewRequest("GET", "/ping", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if string(body) == "" {
		t.Fatal("expected generated request id in body")
	}
	if resp.Header.Get("X-Request-ID") != string(body) {
		t.Fatalf("response header mismatch: %q vs %q", resp.Header.Get("X-Request-ID"), body)
	}
}
