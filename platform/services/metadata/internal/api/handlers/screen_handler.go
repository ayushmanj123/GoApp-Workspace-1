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

type screenHandler struct {
	svc *services.ScreenService
	v   *validator.Validate
}

func NewScreenHandler(store repositories.Store) *screenHandler {
	return &screenHandler{svc: services.NewScreenService(store), v: validator.New()}
}

func (h *screenHandler) Create(c *fiber.Ctx) error {
	var req api.CreateScreenRequest
	if err := c.BodyParser(&req); err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	if err := h.v.Struct(&req); err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	appIDStr := c.Params("appId")
	appID, err := uuid.Parse(appIDStr)
	if err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid application id"})}
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	ctx := context.Background()
	scr, err := h.svc.Create(ctx, tid, appID, req.Name, req.DisplayOrder, req.LayoutType)
	if err != nil {return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	return c.Status(fiber.StatusCreated).JSON(api.APIResponse{Success:true,Data:scr})
}

func (h *screenHandler) List(c *fiber.Ctx) error {
	appIDStr := c.Params("appId")
	appID, err := uuid.Parse(appIDStr)
	if err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid application id"})}
	limit, _ := strconv.Atoi(c.Query("limit","25"))
	offset, _ := strconv.Atoi(c.Query("offset","0"))
	q := c.Query("q","")
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	ctx := context.Background()
	items, total, err := h.svc.ListByApplication(ctx, tid, appID, limit, offset, q)
	if err != nil {return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	return c.JSON(api.APIResponse{Success:true, Data: api.PagedResponse{Items:items, Total: total}})
}

func (h *screenHandler) Update(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid id"})}
	var req api.CreateScreenRequest
	if err := c.BodyParser(&req); err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	if err := h.v.Struct(&req); err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	updates := map[string]interface{}{"name": req.Name, "display_order": req.DisplayOrder, "layout_type": req.LayoutType}
	ctx := context.Background()
	scr, err := h.svc.Update(ctx, tid, id, updates)
	if err != nil {return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	return c.JSON(api.APIResponse{Success:true, Data: scr})
}

func (h *screenHandler) Delete(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid id"})}
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	ctx := context.Background()
	if err := h.svc.Delete(ctx, tid, id); err != nil {return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	return c.SendStatus(fiber.StatusNoContent)
}
