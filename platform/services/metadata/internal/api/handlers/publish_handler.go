package handlers

import (
	"context"
	"strconv"

	"github.com/go-playground/validator/v10"
	"github.com/goapps-platform/metadata-service/internal/api/contracts"
	"github.com/goapps-platform/metadata-service/internal/api/tenant"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/metadata-service/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type publishHandler struct {
	svc   *services.PublishService
	audit *services.AuditService
	v     *validator.Validate
}

func NewPublishHandler(store repositories.Store) *publishHandler {
	return &publishHandler{
		svc:   services.NewPublishService(store),
		audit: services.NewAuditService(store),
		v:     validator.New(),
	}
}

func (h *publishHandler) Publish(c *fiber.Ctx) error {
	appID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: "invalid application id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(contracts.APIResponse{Success: false, Error: "tenant missing"})
	}

	var req contracts.PublishApplicationRequest
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
		}
		if err := h.v.Struct(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
		}
	}

	result, err := h.svc.Publish(context.Background(), tid, appID, services.PublishOptions{
		Version: req.Version,
		Notes:   req.Notes,
	})
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	h.recordAudit(c, tid, "publish", "application", appID)
	return c.Status(fiber.StatusCreated).JSON(contracts.APIResponse{Success: true, Data: result})
}

func (h *publishHandler) Unpublish(c *fiber.Ctx) error {
	appID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: "invalid application id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(contracts.APIResponse{Success: false, Error: "tenant missing"})
	}

	result, err := h.svc.Unpublish(context.Background(), tid, appID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	h.recordAudit(c, tid, "unpublish", "application", appID)
	return c.JSON(contracts.APIResponse{Success: true, Data: result})
}

func (h *publishHandler) Rollback(c *fiber.Ctx) error {
	appID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: "invalid application id"})
	}
	versionID, err := uuid.Parse(c.Params("versionId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: "invalid version id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(contracts.APIResponse{Success: false, Error: "tenant missing"})
	}

	result, err := h.svc.Rollback(context.Background(), tid, appID, versionID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	h.recordAudit(c, tid, "rollback", "application_version", versionID)
	return c.JSON(contracts.APIResponse{Success: true, Data: result})
}

func (h *publishHandler) Deprecate(c *fiber.Ctx) error {
	appID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: "invalid application id"})
	}
	versionID, err := uuid.Parse(c.Params("versionId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: "invalid version id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(contracts.APIResponse{Success: false, Error: "tenant missing"})
	}

	result, err := h.svc.Deprecate(context.Background(), tid, appID, versionID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	h.recordAudit(c, tid, "deprecate", "application_version", versionID)
	return c.JSON(contracts.APIResponse{Success: true, Data: result})
}

// recordAudit writes a best-effort audit trail entry. Audit failures never
// fail the underlying ALM operation — they are logged for operators instead.
func (h *publishHandler) recordAudit(c *fiber.Ctx, tenantID uuid.UUID, action, resourceType string, resourceID uuid.UUID) {
	userID := tenant.GetUserID(c)
	if _, err := h.audit.Record(context.Background(), tenantID, userID, action, resourceType, resourceID); err != nil {
		logHandlerError(c, err, "publish_handler: audit write failed")
	}
}

func (h *publishHandler) ListVersions(c *fiber.Ctx) error {
	appID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: "invalid application id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(contracts.APIResponse{Success: false, Error: "tenant missing"})
	}
	limit, _ := strconv.Atoi(c.Query("limit", "25"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))

	items, total, err := h.svc.ListVersions(context.Background(), tid, appID, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(contracts.APIResponse{Success: true, Data: contracts.PagedResponse{Items: items, Total: total}})
}

func (h *publishHandler) GetVersion(c *fiber.Ctx) error {
	appID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: "invalid application id"})
	}
	versionID, err := uuid.Parse(c.Params("versionId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: "invalid version id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(contracts.APIResponse{Success: false, Error: "tenant missing"})
	}

	item, err := h.svc.GetVersion(context.Background(), tid, appID, versionID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(contracts.APIResponse{Success: true, Data: item})
}
