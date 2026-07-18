package handlers

import (
	"context"
	"strconv"

	"github.com/go-playground/validator/v10"
	api "github.com/goapps-platform/metadata-service/internal/api/contracts"
	"github.com/goapps-platform/metadata-service/internal/api/tenant"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/metadata-service/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type auditHandler struct {
	svc *services.AuditService
	v   *validator.Validate
}

func NewAuditHandler(store repositories.Store) *auditHandler {
	return &auditHandler{svc: services.NewAuditService(store), v: validator.New()}
}

// Create appends a single audit event. Audit events are append-only —
// there is no update or delete endpoint by design.
func (h *auditHandler) Create(c *fiber.Ctx) error {
	var req api.CreateAuditEventRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	if err := h.v.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	resourceID, err := uuid.Parse(req.ResourceID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid resource id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	var userID *uuid.UUID
	if req.UserID != nil {
		if id, parseErr := uuid.Parse(*req.UserID); parseErr == nil {
			userID = &id
		}
	} else {
		userID = tenant.GetUserID(c)
	}

	event, err := h.svc.Record(context.Background(), tid, userID, req.Action, req.ResourceType, resourceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(api.APIResponse{Success: true, Data: event})
}

func (h *auditHandler) List(c *fiber.Ctx) error {
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	items, total, err := h.svc.List(context.Background(), tid, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: api.PagedResponse{Items: items, Total: total}})
}
