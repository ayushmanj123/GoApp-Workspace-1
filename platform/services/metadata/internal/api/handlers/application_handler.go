package handlers

import (
	"context"
	"log/slog"
	"runtime/debug"
	"strconv"

	"github.com/go-playground/validator/v10"
	"github.com/goapps-platform/metadata-service/internal/api/contracts"
	"github.com/goapps-platform/metadata-service/internal/api/tenant"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/metadata-service/internal/services"
	"github.com/goapps-platform/shared/logging"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type applicationHandler struct {
	svc       *services.ApplicationService
	excelSvc  *services.ExcelAppService
	v         *validator.Validate
}

func NewApplicationHandler(store repositories.Store) *applicationHandler {
	return &applicationHandler{
		svc:      services.NewApplicationService(store),
		excelSvc: services.NewExcelAppService(store),
		v:        validator.New(),
	}
}

func (h *applicationHandler) Create(c *fiber.Ctx) error {
	var req contracts.CreateApplicationRequest
	if err := c.BodyParser(&req); err != nil {
		logHandlerError(c, err, "application_handler.Create failed: body parse")
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	if err := h.v.Struct(&req); err != nil {
		logHandlerError(c, err, "application_handler.Create failed: validation")
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		logHandlerError(c, err, "application_handler.Create failed: tenant missing")
		return c.Status(fiber.StatusUnauthorized).JSON(contracts.APIResponse{Success: false, Error: "tenant missing"})
	}

	ctx := context.Background()
	app, err := h.svc.Create(ctx, tid, req.Name, req.Description)
	if err != nil {
		logHandlerError(c, err, "application_handler.Create failed: service error")
		return c.Status(fiber.StatusInternalServerError).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(contracts.APIResponse{Success: true, Data: app})
}

func (h *applicationHandler) List(c *fiber.Ctx) error {
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		logHandlerError(c, err, "application_handler.List failed: tenant missing")
		return c.Status(fiber.StatusUnauthorized).JSON(contracts.APIResponse{Success:false,Error:"tenant missing"})
	}
	limit, _ := strconv.Atoi(c.Query("limit","25"))
	offset, _ := strconv.Atoi(c.Query("offset","0"))
	ctx := context.Background()
	apps, total, err := h.svc.ListByTenant(ctx, tid, limit, offset)
	if err != nil {
		logHandlerError(c, err, "application_handler.List failed: service error")
				return c.Status(fiber.StatusInternalServerError).JSON(contracts.APIResponse{Success:false,Error:err.Error()})
	}
	return c.JSON(contracts.APIResponse{Success:true, Data: contracts.PagedResponse{Items: apps, Total: total}})
}

func logHandlerError(c *fiber.Ctx, err error, msg string) {
	tid, _ := tenant.GetTenantID(c)
	requestID, _ := c.Locals("requestID").(string)
	logger := logging.FromContext(c.UserContext())
	if logger == nil {
		logger = slog.Default()
	}
	logger = logger.With(
		slog.String("tenant_id", tid.String()),
		slog.String("request_id", requestID),
	)
	logger.Error(msg,
		slog.String("error", err.Error()),
		slog.String("stack", string(debug.Stack())),
	)
}

func (h *applicationHandler) Get(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		logHandlerError(c, err, "application_handler.Get failed: invalid id")
				return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success:false,Error:"invalid id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		logHandlerError(c, err, "application_handler.Get failed: tenant missing")
				return c.Status(fiber.StatusUnauthorized).JSON(contracts.APIResponse{Success:false,Error:"tenant missing"})
	}
	ctx := context.Background()
	app, err := h.svc.GetByID(ctx, tid, id)
	if err != nil {
		logHandlerError(c, err, "application_handler.Get failed: service error")
		return c.Status(fiber.StatusNotFound).JSON(contracts.APIResponse{Success:false,Error:err.Error()})
	}
	return c.JSON(contracts.APIResponse{Success:true, Data: app})
}

func (h *applicationHandler) Update(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		logHandlerError(c, err, "application_handler.Update failed: invalid id")
				return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success:false,Error:"invalid id"})
	}
	var req contracts.UpdateApplicationRequest
	if err := c.BodyParser(&req); err != nil {
		logHandlerError(c, err, "application_handler.Update failed: body parse")
			return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success:false,Error:err.Error()})
	}
	if err := h.v.Struct(&req); err != nil {
		logHandlerError(c, err, "application_handler.Update failed: validation")
			return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success:false,Error:err.Error()})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		logHandlerError(c, err, "application_handler.Update failed: tenant missing")
				return c.Status(fiber.StatusUnauthorized).JSON(contracts.APIResponse{Success:false,Error:"tenant missing"})
	}
	updates := map[string]interface{}{}
	if req.Name != nil { updates["name"] = *req.Name }
	if req.Description != nil { updates["description"] = *req.Description }
	if req.Status != nil { updates["status"] = *req.Status }
	if req.OnStart != nil { updates["on_start"] = *req.OnStart }
	if req.CurrentVersionID != nil { updates["current_version_id"] = *req.CurrentVersionID }
	ctx := context.Background()
	app, err := h.svc.Update(ctx, tid, id, updates)
	if err != nil {
		logHandlerError(c, err, "application_handler.Update failed: service error")
		return c.Status(fiber.StatusInternalServerError).JSON(contracts.APIResponse{Success:false,Error:err.Error()})
	}
	return c.JSON(contracts.APIResponse{Success:true, Data: app})
}

func (h *applicationHandler) Delete(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		logHandlerError(c, err, "application_handler.Delete failed: invalid id")
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success:false,Error:"invalid id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		logHandlerError(c, err, "application_handler.Delete failed: tenant missing")
				return c.Status(fiber.StatusUnauthorized).JSON(contracts.APIResponse{Success:false,Error:"tenant missing"})
	}
	ctx := context.Background()
	if err := h.svc.Delete(ctx, tid, id); err != nil {
		logHandlerError(c, err, "application_handler.Delete failed: service error")
		return c.Status(fiber.StatusInternalServerError).JSON(contracts.APIResponse{Success:false,Error:err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *applicationHandler) ExcelAppScaffold(c *fiber.Ctx) error {
	var req contracts.ExcelAppScaffoldRequest
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
	userID := uuid.Nil
	if uid := tenant.GetUserID(c); uid != nil {
		userID = *uid
	}
	bootstrapID, err := uuid.Parse(req.BootstrapConnectorID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(contracts.APIResponse{Success: false, Error: "invalid bootstrap_connector_id"})
	}
	sheets := make([]services.ExcelAppSheetInput, 0, len(req.Sheets))
	for _, sh := range req.Sheets {
		sheets = append(sheets, services.ExcelAppSheetInput{
			SheetName:     sh.SheetName,
			ConnectorName: sh.ConnectorName,
			KeyColumn:     sh.KeyColumn,
			HeaderRow:     sh.HeaderRow,
		})
	}
	result, err := h.excelSvc.Scaffold(context.Background(), tid, userID, services.ExcelAppScaffoldInput{
		AppName:              req.AppName,
		SpreadsheetID:        req.SpreadsheetID,
		Sheets:               sheets,
		Template:             req.Template,
		BootstrapConnectorID: bootstrapID,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(contracts.APIResponse{Success: false, Error: err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(contracts.APIResponse{Success: true, Data: result})
}
