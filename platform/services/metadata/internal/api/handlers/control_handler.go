package handlers

import (
	"context"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/goapps-platform/metadata-service/internal/api"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/metadata-service/internal/services"
)

type controlHandler struct {
	svc *services.ControlService
	v   *validator.Validate
}

func NewControlHandler(store repositories.Store) *controlHandler { return &controlHandler{svc: services.NewControlService(store), v: validator.New()} }

func (h *controlHandler) Create(c *fiber.Ctx) error {
	var req api.CreateControlRequest
	if err := c.BodyParser(&req); err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	if err := h.v.Struct(&req); err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	scrIDStr := c.Params("screenId")
	scrID, err := uuid.Parse(scrIDStr)
	if err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid screen id"})}
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	var parent *uuid.UUID
	if req.ParentControlID != nil { pu, perr := uuid.Parse(*req.ParentControlID); if perr == nil { parent = &pu } }
	ctx := context.Background()
	ctl, err := h.svc.Create(ctx, tid, scrID, req.Name, req.ControlType, req.X, req.Y, req.Width, req.Height, req.ZIndex, parent)
	if err != nil {return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	return c.Status(fiber.StatusCreated).JSON(api.APIResponse{Success:true,Data:ctl})
}

func (h *controlHandler) List(c *fiber.Ctx) error {
	scrIDStr := c.Params("screenId")
	scrID, err := uuid.Parse(scrIDStr)
	if err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid screen id"})}
	limit, _ := strconv.Atoi(c.Query("limit","25"))
	offset, _ := strconv.Atoi(c.Query("offset","0"))
	q := c.Query("q","")
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	ctx := context.Background()
	items, total, err := h.svc.ListByScreen(ctx, tid, scrID, limit, offset, q)
	if err != nil {return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	return c.JSON(api.APIResponse{Success:true,Data: api.PagedResponse{Items:items, Total: total}})
}

func (h *controlHandler) Update(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid id"})}
	var req api.CreateControlRequest
	if err := c.BodyParser(&req); err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	if err := h.v.Struct(&req); err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	updates := map[string]interface{}{
		"name": req.Name,
		"control_type": req.ControlType,
		"x": req.X,
		"y": req.Y,
		"width": req.Width,
		"height": req.Height,
		"z_index": req.ZIndex,
	}
	if req.ParentControlID != nil { updates["parent_control_id"] = *req.ParentControlID }
	ctx := context.Background()
	ctl, err := h.svc.Update(ctx, tid, id, updates)
	if err != nil {return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	return c.JSON(api.APIResponse{Success:true,Data:ctl})
}

func (h *controlHandler) Delete(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid id"})}
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	ctx := context.Background()
	if err := h.svc.Delete(ctx, tid, id); err != nil {return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *controlHandler) Delete(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid id"})}
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	ctx := context.Background()
	if err := h.svc.Delete(ctx, tid, id); err != nil {return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	return c.SendStatus(fiber.StatusNoContent)
}
