package handlers

import (
	"context"

	"github.com/gofiber/fiber/v2"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/goapps-platform/metadata-service/internal/api"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/metadata-service/internal/services"
)

type propertyHandler struct {
	svc *services.PropertyService
	v   *validator.Validate
}

func NewPropertyHandler(store repositories.Store) *propertyHandler { return &propertyHandler{svc: services.NewPropertyService(store), v: validator.New()} }

func (h *propertyHandler) Update(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid id"})}
	var req api.UpdatePropertiesRequest
	if err := c.BodyParser(&req); err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	if err := h.v.Struct(&req); err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	ctx := context.Background()
	if err := h.svc.Update(ctx, tid, id, req.Properties); err != nil {return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *propertyHandler) Get(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid id"})}
	tid, err := api.GetTenantID(c)
	if err != nil {return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"})}
	ctx := context.Background()
	props, err := h.svc.Get(ctx, tid, id)
	if err != nil {return c.Status(fiber.StatusNotFound).JSON(api.APIResponse{Success:false,Error:err.Error()})}
	return c.JSON(api.APIResponse{Success:true,Data:props})
}
