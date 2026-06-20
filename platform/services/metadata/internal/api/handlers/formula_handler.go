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

type formulaHandler struct {
	svc *services.FormulaService
	v   *validator.Validate
}

func NewFormulaHandler(store repositories.Store) *formulaHandler {
	return &formulaHandler{svc: services.NewFormulaService(store), v: validator.New()}
}

func (h *formulaHandler) Create(c *fiber.Ctx) error {
	var req contracts.CreateFormulaRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	if err := h.v.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	idStr := c.Params("id")
	ctlID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: "invalid control id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(contracts.APIResponse{Success: false, Error: "tenant missing"})
	}
	ctx := context.Background()
	f, err := h.svc.Create(ctx, tid, ctlID, req.PropertyName, req.FormulaText, req.FormulaType)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(contracts.APIResponse{Success: true, Data: f})
}

func (h *formulaHandler) List(c *fiber.Ctx) error {
	idStr := c.Params("id")
	ctlID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: "invalid control id"})
	}
	limit, _ := strconv.Atoi(c.Query("limit", "25"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(contracts.APIResponse{Success: false, Error: "tenant missing"})
	}
	ctx := context.Background()
	q := c.Query("q", "")
	items, total, err := h.svc.ListByControl(ctx, tid, ctlID, limit, offset, q)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(contracts.APIResponse{Success: true, Data: contracts.PagedResponse{Items: items, Total: total}})
}

func (h *formulaHandler) Update(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: "invalid id"})
	}
	var req contracts.UpdateFormulaRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	if err := h.v.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(contracts.APIResponse{Success: false, Error: "tenant missing"})
	}
	updates := map[string]interface{}{}
	if req.PropertyName != nil {
		updates["property_name"] = *req.PropertyName
	}
	if req.FormulaText != nil {
		updates["formula_text"] = *req.FormulaText
	}
	if req.FormulaType != nil {
		updates["formula_type"] = *req.FormulaType
	}
	ctx := context.Background()
	f, err := h.svc.Update(ctx, tid, id, updates)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(contracts.APIResponse{Success: true, Data: f})
}

func (h *formulaHandler) Delete(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: "invalid id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(contracts.APIResponse{Success: false, Error: "tenant missing"})
	}
	ctx := context.Background()
	if err := h.svc.Delete(ctx, tid, id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
