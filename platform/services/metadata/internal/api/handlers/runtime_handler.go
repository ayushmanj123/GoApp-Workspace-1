package handlers

import (
	"context"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/goapps-platform/metadata-service/internal/api"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/metadata-service/internal/services"
)

type runtimeHandler struct { svc *services.RuntimeService }

func NewRuntimeHandler(store repositories.Store) *runtimeHandler { return &runtimeHandler{svc: services.NewRuntimeService(store)} }

// GET /api/v1/runtime/applications/:id
func (h *runtimeHandler) GetApplication(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil { return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid id"}) }
	tid, err := api.GetTenantID(c)
	if err != nil { return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"}) }
	ctx := context.Background()
	pkg, err := h.svc.BuildRuntimePackage(ctx, tid, id)
	if err != nil { return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()}) }
	return c.JSON(api.APIResponse{Success:true,Data:pkg})
}

// GET /api/v1/runtime/applications/:id/screens
func (h *runtimeHandler) GetApplicationScreens(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil { return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid id"}) }
	tid, err := api.GetTenantID(c)
	if err != nil { return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"}) }
	ctx := context.Background()
	pkg, err := h.svc.BuildRuntimePackage(ctx, tid, id)
	if err != nil { return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()}) }
	return c.JSON(api.APIResponse{Success:true,Data:pkg.Screens})
}

// GET /api/v1/runtime/screens/:id
func (h *runtimeHandler) GetScreen(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil { return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid id"}) }
	tid, err := api.GetTenantID(c)
	if err != nil { return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"}) }
	ctx := context.Background()
	appID, err := h.svc.FindScreenOwner(ctx, tid, id)
	if err != nil { return c.Status(fiber.StatusNotFound).JSON(api.APIResponse{Success:false,Error:"screen not found"}) }
	pkg, perr := h.svc.BuildRuntimePackage(ctx, tid, appID)
	if perr != nil { return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:perr.Error()}) }
	for _, rs := range pkg.Screens { if rs.ID == id { target := rs; return c.JSON(api.APIResponse{Success:true,Data:&target}) } }
	return c.Status(fiber.StatusNotFound).JSON(api.APIResponse{Success:false,Error:"screen not found"})
}

// GET /api/v1/runtime/screens/:id/tree
func (h *runtimeHandler) GetScreenTree(c *fiber.Ctx) error {
idStr := c.Params("id")
id, err := uuid.Parse(idStr)
if err != nil { return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success:false,Error:"invalid id"}) }
tid, err := api.GetTenantID(c)
if err != nil { return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success:false,Error:"tenant missing"}) }
ctx := context.Background()
appID, err := h.svc.FindScreenOwner(ctx, tid, id)
if err != nil { return c.Status(fiber.StatusNotFound).JSON(api.APIResponse{Success:false,Error:"screen not found"}) }
pkg, err := h.svc.BuildRuntimePackage(ctx, tid, appID)
if err != nil { return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success:false,Error:err.Error()}) }
for _, rs := range pkg.Screens { if rs.ID == id { return c.JSON(api.APIResponse{Success:true,Data:rs.Controls}) } }
return c.Status(fiber.StatusNotFound).JSON(api.APIResponse{Success:false,Error:"screen not found"})
}
