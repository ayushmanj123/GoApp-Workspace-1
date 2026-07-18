package handlers

import (
	"github.com/goapps-platform/publish-service/internal/client"
	"github.com/goapps-platform/shared/auth"
	"github.com/gofiber/fiber/v2"
)

type PublishHandler struct {
	metadata *client.MetadataClient
}

func NewPublishHandler(metadata *client.MetadataClient) *PublishHandler {
	return &PublishHandler{metadata: metadata}
}

func (h *PublishHandler) Publish(c *fiber.Ctx) error {
	return h.forward(c, func(hdr client.ForwardHeaders) (*client.APIResponse, int, error) {
		return h.metadata.Publish(c.Params("id"), hdr, c.Body())
	})
}

func (h *PublishHandler) ListVersions(c *fiber.Ctx) error {
	return h.forward(c, func(hdr client.ForwardHeaders) (*client.APIResponse, int, error) {
		return h.metadata.ListVersions(c.Params("id"), hdr, string(c.Request().URI().QueryString()))
	})
}

func (h *PublishHandler) GetVersion(c *fiber.Ctx) error {
	return h.forward(c, func(hdr client.ForwardHeaders) (*client.APIResponse, int, error) {
		return h.metadata.GetVersion(c.Params("id"), c.Params("versionId"), hdr)
	})
}

func (h *PublishHandler) Unpublish(c *fiber.Ctx) error {
	return h.forward(c, func(hdr client.ForwardHeaders) (*client.APIResponse, int, error) {
		return h.metadata.Unpublish(c.Params("id"), hdr, c.Body())
	})
}

func (h *PublishHandler) Rollback(c *fiber.Ctx) error {
	return h.forward(c, func(hdr client.ForwardHeaders) (*client.APIResponse, int, error) {
		return h.metadata.Rollback(c.Params("id"), c.Params("versionId"), hdr, c.Body())
	})
}

func (h *PublishHandler) Deprecate(c *fiber.Ctx) error {
	return h.forward(c, func(hdr client.ForwardHeaders) (*client.APIResponse, int, error) {
		return h.metadata.Deprecate(c.Params("id"), c.Params("versionId"), hdr, c.Body())
	})
}

func (h *PublishHandler) forward(c *fiber.Ctx, call func(hdr client.ForwardHeaders) (*client.APIResponse, int, error)) error {
	ac, ok := auth.GetFiberAuthContext(c)
	if !ok || ac == nil || !ac.IsAuthenticated {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "authentication required"})
	}
	requestID, _ := c.Locals("requestID").(string)
	hdr := client.ForwardHeaders{
		TenantID:      ac.TenantID.String(),
		UserID:        ac.UserID.String(),
		Authorization: c.Get("Authorization"),
		RequestID:     requestID,
	}
	// Development mode may authenticate via headers only (no bearer). Mint a
	// compatible dev token so metadata auth middleware accepts the hop.
	if hdr.Authorization == "" {
		hdr.Authorization = "Bearer dev:" + hdr.TenantID + ":" + hdr.UserID
	}
	envelope, status, err := call(hdr)
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
