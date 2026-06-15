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

type formulaHandler struct {
	svc *services.FormulaService
	v   *validator.Validate
}

func NewFormulaHandler(store repositories.Store) *formulaHandler { return &formulaHandler{svc: services.NewFormulaService(store), v: validator.New()} }

func (h *formulaHandler) Create(c *fiber.Ctx) error {
	var req api.CreateFormulaRequest
	if err := c.BodyParser(&req); err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	if err := h.v.Struct(&req); err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	idStr := c.Params("id")
	ctlID, err := uuid.Parse(idStr)
	if err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid control id"})}
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	ctx := context.Background()
	f, err := h.svc.Create(ctx, tid, ctlID, req.PropertyName, req.FormulaText, req.FormulaType)
	if err != nil {return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	return c.Status(fiber.StatusCreated).JSON(api.APIResponse{Success:true,Data:f})
}

func (h *formulaHandler) List(c *fiber.Ctx) error {
	idStr := c.Params("id")
	ctlID, err := uuid.Parse(idStr)
	if err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid control id"})}
	limit, _ := strconv.Atoi(c.Query("limit","25"))
	offset, _ := strconv.Atoi(c.Query("offset","0"))
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	ctx := context.Background()
	q := c.Query("q","")
		items, total, err := h.svc.ListByControl(ctx, tid, ctlID, limit, offset, q)
		if err != nil {return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()})}
		return c.JSON(api.APIResponse{Success:true, Data: api.PagedResponse{Items: items, Total: total}})
}

func (h *formulaHandler) Update(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid id"})}
	var req api.UpdateFormulaRequest
	if err := c.BodyParser(&req); err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	if err := h.v.Struct(&req); err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	updates := map[string]interface{}{}
	if req.PropertyName != nil { updates["property_name"] = *req.PropertyName }
	if req.FormulaText != nil { updates["formula_text"] = *req.FormulaText }
	if req.FormulaType != nil { updates["formula_type"] = *req.FormulaType }
	ctx := context.Background()
	f, err := h.svc.Update(ctx, tid, id, updates)
	if err != nil {return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	return c.JSON(api.APIResponse{Success:true,Data:f})
}

func (h *formulaHandler) Delete(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid id"})}
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	ctx := context.Background()
	if err := h.svc.Delete(ctx, tid, id); err != nil {return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	return c.SendStatus(fiber.StatusNoContent)
}
