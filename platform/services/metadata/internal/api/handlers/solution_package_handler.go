package handlers

import (
	"context"
	"errors"

	"github.com/go-playground/validator/v10"
	api "github.com/goapps-platform/metadata-service/internal/api/contracts"
	"github.com/goapps-platform/metadata-service/internal/api/tenant"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/metadata-service/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type solutionPackageHandler struct {
	svc *services.SolutionPackageService
	v   *validator.Validate
}

func NewSolutionPackageHandler(store repositories.Store) *solutionPackageHandler {
	return &solutionPackageHandler{
		svc: services.NewSolutionPackageService(store),
		v:   validator.New(),
	}
}

func (h *solutionPackageHandler) List(c *fiber.Ctx) error {
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	items, err := h.svc.List(context.Background(), tid)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{
		Success: true,
		Data:    api.PagedResponse{Items: items, Total: int64(len(items))},
	})
}

func (h *solutionPackageHandler) Create(c *fiber.Ctx) error {
	var req api.CreateSolutionPackageRequest
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
	pkg, err := h.svc.Create(context.Background(), tid, req.Name, req.DisplayName, req.Description)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(api.APIResponse{Success: true, Data: pkg})
}

func (h *solutionPackageHandler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid package id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	pkg, err := h.svc.Get(context.Background(), tid, id)
	if err != nil {
		return mapPackageError(c, err)
	}
	return c.JSON(api.APIResponse{Success: true, Data: pkg})
}

func (h *solutionPackageHandler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid package id"})
	}
	var req api.UpdateSolutionPackageRequest
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
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Version != nil {
		updates["version"] = *req.Version
	}
	if len(updates) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "no fields to update"})
	}
	pkg, err := h.svc.Update(context.Background(), tid, id, updates)
	if err != nil {
		return mapPackageError(c, err)
	}
	return c.JSON(api.APIResponse{Success: true, Data: pkg})
}

func (h *solutionPackageHandler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid package id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	if err := h.svc.Delete(context.Background(), tid, id); err != nil {
		return mapPackageError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *solutionPackageHandler) ListComponents(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid package id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	items, err := h.svc.ListComponents(context.Background(), tid, id)
	if err != nil {
		return mapPackageError(c, err)
	}
	return c.JSON(api.APIResponse{
		Success: true,
		Data:    api.PagedResponse{Items: items, Total: int64(len(items))},
	})
}

func (h *solutionPackageHandler) AddComponent(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid package id"})
	}
	var req api.AddPackageComponentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	if err := h.v.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	componentID, err := uuid.Parse(req.ComponentID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid component id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	item, err := h.svc.AddComponent(context.Background(), tid, id, req.ComponentType, componentID)
	if err != nil {
		return mapPackageError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(api.APIResponse{Success: true, Data: item})
}

func (h *solutionPackageHandler) RemoveComponent(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid package id"})
	}
	componentType := c.Params("componentType")
	componentID, err := uuid.Parse(c.Params("componentId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid component id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	if err := h.svc.RemoveComponent(context.Background(), tid, id, componentType, componentID); err != nil {
		return mapPackageError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func mapPackageError(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, services.ErrPackageNotFound), errors.Is(err, services.ErrComponentNotFound):
		return c.Status(fiber.StatusNotFound).JSON(api.APIResponse{Success: false, Error: err.Error()})
	case errors.Is(err, services.ErrPackageMasterRO),
		errors.Is(err, services.ErrPackageManagedRO),
		errors.Is(err, services.ErrInvalidComponentType),
		errors.Is(err, services.ErrComponentExists):
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	default:
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
}
