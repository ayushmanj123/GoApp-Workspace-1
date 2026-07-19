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

type entityHandler struct {
	svc *services.EntityService
	v   *validator.Validate
}

func NewEntityHandler(store repositories.Store) *entityHandler {
	return &entityHandler{
		svc: services.NewEntityService(store),
		v:   validator.New(),
	}
}

func (h *entityHandler) Create(c *fiber.Ctx) error {
	var req api.CreateEntityRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	if err := h.v.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	appID, err := uuid.Parse(c.Params("appId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid application id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	ctx := context.Background()
	entity, err := h.svc.Create(ctx, tid, appID, req.Name, req.DisplayName)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(api.APIResponse{Success: true, Data: entity})
}

func (h *entityHandler) List(c *fiber.Ctx) error {
	appID, err := uuid.Parse(c.Params("appId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid application id"})
	}
	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	ctx := context.Background()
	items, total, err := h.svc.ListByApplication(ctx, tid, appID, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: api.PagedResponse{Items: items, Total: total}})
}

func (h *entityHandler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	var req api.UpdateEntityRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	if err := h.v.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.DisplayName != nil {
		updates["display_name"] = *req.DisplayName
	}
	if len(updates) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "no fields to update"})
	}
	ctx := context.Background()
	entity, err := h.svc.Update(ctx, tid, id, updates)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: entity})
}

func (h *entityHandler) CreateField(c *fiber.Ctx) error {
	var req api.CreateEntityFieldRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	if err := h.v.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	entityID, err := uuid.Parse(c.Params("entityId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid entity id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	var relatedEntityID *uuid.UUID
	if req.RelatedEntityID != nil && *req.RelatedEntityID != "" {
		parsed, err := uuid.Parse(*req.RelatedEntityID)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid related_entity_id"})
		}
		relatedEntityID = &parsed
	}
	ctx := context.Background()
	field, err := h.svc.CreateField(ctx, tid, entityID, req.Name, req.DisplayName, req.FieldType, relatedEntityID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(api.APIResponse{Success: true, Data: field})
}

func (h *entityHandler) ListFields(c *fiber.Ctx) error {
	entityID, err := uuid.Parse(c.Params("entityId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid entity id"})
	}
	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	ctx := context.Background()
	items, total, err := h.svc.ListFields(ctx, tid, entityID, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: api.PagedResponse{Items: items, Total: total}})
}

func (h *entityHandler) UpdateField(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	var req api.UpdateEntityFieldRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	if err := h.v.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.DisplayName != nil {
		updates["display_name"] = *req.DisplayName
	}
	if req.FieldType != nil {
		updates["field_type"] = *req.FieldType
	}
	if req.RelatedEntityID != nil {
		if *req.RelatedEntityID == "" {
			updates["related_entity_id"] = (*uuid.UUID)(nil)
		} else {
			parsed, err := uuid.Parse(*req.RelatedEntityID)
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid related_entity_id"})
			}
			updates["related_entity_id"] = &parsed
		}
	}
	if len(updates) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "no fields to update"})
	}
	ctx := context.Background()
	field, err := h.svc.UpdateField(ctx, tid, id, updates)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: field})
}
