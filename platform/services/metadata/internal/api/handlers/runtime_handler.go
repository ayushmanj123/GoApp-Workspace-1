package handlers

import (
	"context"
	"errors"
	"strings"

	"github.com/goapps-platform/metadata-service/internal/api/contracts"
	"github.com/goapps-platform/metadata-service/internal/api/tenant"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/metadata-service/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type runtimeHandler struct{ svc *services.RuntimeService }

func NewRuntimeHandler(store repositories.Store) *runtimeHandler {
	return &runtimeHandler{svc: services.NewRuntimeService(store)}
}

func (h *runtimeHandler) runtimeOptions(c *fiber.Ctx) services.RuntimePackageOptions {
	opts := services.RuntimePackageOptions{Channel: c.Query("channel", "published")}
	if envRaw := strings.TrimSpace(c.Query("environmentId")); envRaw != "" {
		if envID, err := uuid.Parse(envRaw); err == nil {
			opts.EnvironmentID = &envID
		}
	}
	return opts
}

// GET /api/v1/runtime/applications/:id
func (h *runtimeHandler) GetApplication(c *fiber.Ctx) error {
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
	pkg, err := h.svc.BuildRuntimePackageWithOptions(ctx, tid, id, h.runtimeOptions(c))
	if err != nil {
		status := fiber.StatusInternalServerError
		if errors.Is(err, services.ErrEnvironmentNotFound) || errors.Is(err, services.ErrEnvironmentNotPromoted) {
			status = fiber.StatusNotFound
		}
		return c.Status(status).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(contracts.APIResponse{Success: true, Data: pkg})
}

// GET /api/v1/runtime/applications/:id/screens
func (h *runtimeHandler) GetApplicationScreens(c *fiber.Ctx) error {
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
	pkg, err := h.svc.BuildRuntimePackageWithOptions(ctx, tid, id, h.runtimeOptions(c))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(contracts.APIResponse{Success: true, Data: pkg.Screens})
}

// GET /api/v1/runtime/screens/:id
func (h *runtimeHandler) GetScreen(c *fiber.Ctx) error {
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
	appID, err := h.svc.FindScreenOwner(ctx, tid, id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(contracts.APIResponse{Success: false, Error: "screen not found"})
	}
	pkg, perr := h.svc.BuildRuntimePackageWithOptions(ctx, tid, appID, h.runtimeOptions(c))
	if perr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(contracts.APIResponse{Success: false, Error: perr.Error()})
	}
	for _, rs := range pkg.Screens {
		if rs.ID == id {
			target := rs
			return c.JSON(contracts.APIResponse{Success: true, Data: &target})
		}
	}
	return c.Status(fiber.StatusNotFound).JSON(contracts.APIResponse{Success: false, Error: "screen not found"})
}

// GET /api/v1/runtime/screens/:id/tree
func (h *runtimeHandler) GetScreenTree(c *fiber.Ctx) error {
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
	appID, err := h.svc.FindScreenOwner(ctx, tid, id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(contracts.APIResponse{Success: false, Error: "screen not found"})
	}
	pkg, err := h.svc.BuildRuntimePackageWithOptions(ctx, tid, appID, h.runtimeOptions(c))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	for _, rs := range pkg.Screens {
		if rs.ID == id {
			return c.JSON(contracts.APIResponse{Success: true, Data: rs.Controls})
		}
	}
	return c.Status(fiber.StatusNotFound).JSON(contracts.APIResponse{Success: false, Error: "screen not found"})
}
