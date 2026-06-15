package handlers

import (
	"context"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/goapps-platform/metadata-service/internal/api"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/metadata-service/internal/services"
)

type applicationHandler struct {
	svc *services.ApplicationService
	v   *validator.Validate
}

func NewApplicationHandler(store repositories.Store) *applicationHandler {
	return &applicationHandler{svc: services.NewApplicationService(store), v: validator.New()}
}

func (h *applicationHandler) Create(c *fiber.Ctx) error {
	var req api.CreateApplicationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	if err := h.v.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	tid, err := api.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}

	ctx := context.Background()
	app, err := h.svc.Create(ctx, tid, req.Name, req.Description)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(api.APIResponse{Success: true, Data: app})
}

func (h *applicationHandler) List(c *fiber.Ctx) error {
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	limit, _ := strconv.Atoi(c.Query("limit","25"))
	offset, _ := strconv.Atoi(c.Query("offset","0"))
	ctx := context.Background()
	apps, total, err := h.svc.ListByTenant(ctx, tid, limit, offset)
	if err != nil {return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	return c.JSON(api.APIResponse{Success:true, Data: api.PagedResponse{Items: apps, Total: total}})
}

func (h *applicationHandler) Get(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid id"})}
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	ctx := context.Background()
	app, err := h.svc.GetByID(ctx, tid, id)
	if err != nil {return c.Status(fiber.StatusNotFound).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	return c.JSON(api.APIResponse{Success:true, Data: app})
}

func (h *applicationHandler) Update(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid id"})}
	var req api.UpdateApplicationRequest
	if err := c.BodyParser(&req); err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	if err := h.v.Struct(&req); err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	updates := map[string]interface{}{}
	if req.Name != nil { updates["name"] = *req.Name }
	if req.Description != nil { updates["description"] = *req.Description }
	if req.Status != nil { updates["status"] = *req.Status }
	if req.CurrentVersionID != nil { updates["current_version_id"] = *req.CurrentVersionID }
	ctx := context.Background()
	app, err := h.svc.Update(ctx, tid, id, updates)
	if err != nil {return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	return c.JSON(api.APIResponse{Success:true, Data: app})
}

func (h *applicationHandler) Delete(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid id"})}
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	ctx := context.Background()
	if err := h.svc.Delete(ctx, tid, id); err != nil {return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	return c.SendStatus(fiber.StatusNoContent)
}
