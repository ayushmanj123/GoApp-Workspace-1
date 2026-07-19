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

type environmentHandler struct {
	svc      *services.EnvironmentService
	audit    *services.AuditService
	v        *validator.Validate
	storeRef repositories.Store
}

func NewEnvironmentHandler(store repositories.Store) *environmentHandler {
	return &environmentHandler{
		svc:      services.NewEnvironmentService(store),
		audit:    services.NewAuditService(store),
		v:        validator.New(),
		storeRef: store,
	}
}

func (h *environmentHandler) List(c *fiber.Ctx) error {
	appID, err := uuid.Parse(c.Params("appId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid application id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	items, err := h.svc.List(context.Background(), tid, appID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: api.PagedResponse{Items: items, Total: int64(len(items))}})
}

func (h *environmentHandler) Create(c *fiber.Ctx) error {
	appID, err := uuid.Parse(c.Params("appId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid application id"})
	}
	var req api.CreateEnvironmentRequest
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
	env, err := h.svc.Create(context.Background(), tid, appID, req.Name, req.EnvironmentType)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(api.APIResponse{Success: true, Data: env})
}

func (h *environmentHandler) Get(c *fiber.Ctx) error {
	appID, err := uuid.Parse(c.Params("appId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid application id"})
	}
	envID, err := uuid.Parse(c.Params("envId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid environment id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	env, err := h.svc.Get(context.Background(), tid, appID, envID)
	if err != nil {
		return mapEnvironmentError(c, err)
	}
	return c.JSON(api.APIResponse{Success: true, Data: env})
}

func (h *environmentHandler) Update(c *fiber.Ctx) error {
	appID, err := uuid.Parse(c.Params("appId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid application id"})
	}
	envID, err := uuid.Parse(c.Params("envId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid environment id"})
	}
	var req api.UpdateEnvironmentRequest
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
	if req.EnvironmentType != nil {
		updates["environment_type"] = *req.EnvironmentType
	}
	if len(updates) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "no fields to update"})
	}
	env, err := h.svc.Update(context.Background(), tid, appID, envID, updates)
	if err != nil {
		return mapEnvironmentError(c, err)
	}
	return c.JSON(api.APIResponse{Success: true, Data: env})
}

func (h *environmentHandler) Delete(c *fiber.Ctx) error {
	appID, err := uuid.Parse(c.Params("appId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid application id"})
	}
	envID, err := uuid.Parse(c.Params("envId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid environment id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	if err := h.svc.Delete(context.Background(), tid, appID, envID); err != nil {
		return mapEnvironmentError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *environmentHandler) Promote(c *fiber.Ctx) error {
	appID, err := uuid.Parse(c.Params("appId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid application id"})
	}
	envID, err := uuid.Parse(c.Params("envId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid environment id"})
	}
	var req api.PromoteEnvironmentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	if err := h.v.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	versionID, err := uuid.Parse(req.VersionID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid version id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	env, err := h.svc.Promote(context.Background(), tid, appID, envID, versionID)
	if err != nil {
		return mapEnvironmentError(c, err)
	}
	userID := tenant.GetUserID(c)
	if _, auditErr := h.audit.Record(context.Background(), tid, userID, "promote", "environment", envID); auditErr != nil {
		logHandlerError(c, auditErr, "environment_handler: audit write failed")
	}
	return c.JSON(api.APIResponse{Success: true, Data: env})
}

func (h *environmentHandler) ListSecretOverrides(c *fiber.Ctx) error {
	appID, err := uuid.Parse(c.Params("appId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid application id"})
	}
	envID, err := uuid.Parse(c.Params("envId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid environment id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	items, err := services.NewEnvironmentSecretService(h.storeRef).ListForEnvironment(context.Background(), tid, appID, envID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: api.PagedResponse{Items: items, Total: int64(len(items))}})
}

func (h *environmentHandler) UpsertSecretOverride(c *fiber.Ctx) error {
	appID, err := uuid.Parse(c.Params("appId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid application id"})
	}
	envID, err := uuid.Parse(c.Params("envId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid environment id"})
	}
	var req api.UpsertEnvironmentSecretOverrideRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	if err := h.v.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	connectorID, err := uuid.Parse(req.ConnectorID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid connector id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	view, err := services.NewEnvironmentSecretService(h.storeRef).Upsert(context.Background(), tid, appID, envID, connectorID, req.Value)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: view})
}

func (h *environmentHandler) DeleteSecretOverride(c *fiber.Ctx) error {
	appID, err := uuid.Parse(c.Params("appId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid application id"})
	}
	envID, err := uuid.Parse(c.Params("envId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid environment id"})
	}
	connectorID, err := uuid.Parse(c.Params("connectorId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid connector id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	if err := services.NewEnvironmentSecretService(h.storeRef).Delete(context.Background(), tid, appID, envID, connectorID); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: map[string]string{"status": "deleted"}})
}

func mapEnvironmentError(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, services.ErrEnvironmentNotFound):
		return c.Status(fiber.StatusNotFound).JSON(api.APIResponse{Success: false, Error: err.Error()})
	case errors.Is(err, services.ErrVersionNotReleased), errors.Is(err, services.ErrVersionMismatch):
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	default:
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
}
