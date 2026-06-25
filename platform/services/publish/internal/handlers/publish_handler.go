package handlers

import (
	"github.com/goapps-platform/publish-service/internal/client"
	"github.com/gofiber/fiber/v2"
)

type PublishHandler struct {
	metadata *client.MetadataClient
}

func NewPublishHandler(metadata *client.MetadataClient) *PublishHandler {
	return &PublishHandler{metadata: metadata}
}

func (h *PublishHandler) Publish(c *fiber.Ctx) error {
	return h.forward(c, func(tenantID, requestID string) (*client.APIResponse, int, error) {
		return h.metadata.Publish(c.Params("id"), tenantID, requestID, c.Body())
	})
}

func (h *PublishHandler) ListVersions(c *fiber.Ctx) error {
	return h.forward(c, func(tenantID, requestID string) (*client.APIResponse, int, error) {
		return h.metadata.ListVersions(c.Params("id"), tenantID, requestID, string(c.Request().URI().QueryString()))
	})
}

func (h *PublishHandler) GetVersion(c *fiber.Ctx) error {
	return h.forward(c, func(tenantID, requestID string) (*client.APIResponse, int, error) {
		return h.metadata.GetVersion(c.Params("id"), c.Params("versionId"), tenantID, requestID)
	})
}

func (h *PublishHandler) forward(c *fiber.Ctx, call func(tenantID, requestID string) (*client.APIResponse, int, error)) error {
	tenantID := c.Get("X-Tenant-Id")
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "tenant missing"})
	}
	requestID, _ := c.Locals("requestID").(string)
	envelope, status, err := call(tenantID, requestID)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"success": false, "error": err.Error()})
	}
	if status == 0 {
		status = fiber.StatusOK
	}
	if !envelope.Success && status < 400 {
		status = fiber.StatusBadRequest
	}
	return c.Status(status).JSON(envelope)
}
