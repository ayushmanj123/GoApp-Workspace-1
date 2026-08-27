package handlers

import (
	"context"
	"strconv"
	"strings"

	"github.com/go-playground/validator/v10"
	api "github.com/goapps-platform/metadata-service/internal/api/contracts"
	"github.com/goapps-platform/metadata-service/internal/api/tenant"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/metadata-service/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type connectorHandler struct {
	svc *services.ConnectorService
	v   *validator.Validate
}

func NewConnectorHandler(store repositories.Store) *connectorHandler {
	return &connectorHandler{
		svc: services.NewConnectorService(store),
		v:   validator.New(),
	}
}

func (h *connectorHandler) Create(c *fiber.Ctx) error {
	var req api.CreateConnectorRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	if err := h.v.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	appID, err := uuid.Parse(c.Params("appId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid application id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	ctx := context.Background()
	connector, err := h.svc.Create(ctx, tid, appID, req.Name, req.ConnectorType, req.AuthenticationType, req.BaseURL, req.AuthConfig)
	if err != nil {
		status := fiber.StatusInternalServerError
		if isClientAuthConfigError(err) {
			status = fiber.StatusBadRequest
		}
		return c.Status(status).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(api.APIResponse{Success: true, Data: connector})
}

func (h *connectorHandler) List(c *fiber.Ctx) error {
	appID, err := uuid.Parse(c.Params("appId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid application id"})
	}
	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	ctx := context.Background()
	items, total, err := h.svc.ListByApplication(ctx, tid, appID, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: api.PagedResponse{Items: items, Total: total}})
}

func (h *connectorHandler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	ctx := context.Background()
	connector, err := h.svc.Get(ctx, tid, id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: connector})
}

func (h *connectorHandler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	var req api.UpdateConnectorRequest
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
	if req.AuthenticationType != nil {
		updates["authentication_type"] = *req.AuthenticationType
	}
	if req.BaseURL != nil {
		updates["base_url"] = *req.BaseURL
	}
	if len(req.AuthConfig) > 0 {
		updates["auth_config"] = []byte(req.AuthConfig)
	}
	if len(updates) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "no fields to update"})
	}
	ctx := context.Background()
	connector, err := h.svc.Update(ctx, tid, id, updates)
	if err != nil {
		status := fiber.StatusInternalServerError
		if isClientAuthConfigError(err) {
			status = fiber.StatusBadRequest
		}
		return c.Status(status).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: connector})
}

func (h *connectorHandler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	ctx := context.Background()
	if err := h.svc.Delete(ctx, tid, id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *connectorHandler) StartOAuth(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	userID := tenant.GetUserID(c)
	if userID == nil || *userID == uuid.Nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "user missing"})
	}
	var body struct {
		ReturnTo string `json:"return_to"`
	}
	_ = c.BodyParser(&body)
	result, err := h.svc.StartOAuthAuthorizationCode(context.Background(), tid, id, *userID, body.ReturnTo)
	if err != nil {
		status := fiber.StatusInternalServerError
		if isClientAuthConfigError(err) || strings.Contains(err.Error(), "authentication_type") || strings.Contains(err.Error(), "user id") {
			status = fiber.StatusBadRequest
		}
		return c.Status(status).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: result})
}

func (h *connectorHandler) OAuthCallback(c *fiber.Ctx) error {
	code := c.Query("code")
	state := c.Query("state")
	if errParam := c.Query("error"); errParam != "" {
		desc := c.Query("error_description")
		return c.Status(fiber.StatusBadRequest).SendString("oauth error: " + errParam + " " + desc)
	}
	redirectURL, err := h.svc.CompleteOAuthCallback(context.Background(), code, state)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString(err.Error())
	}
	return c.Redirect(redirectURL, fiber.StatusFound)
}

func (h *connectorHandler) GetOAuthConnection(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	userID := uuid.Nil
	if uid := tenant.GetUserID(c); uid != nil {
		userID = *uid
	}
	status, err := h.svc.GetOAuthConnectionStatus(context.Background(), tid, id, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: status})
}

func (h *connectorHandler) DeleteOAuthConnection(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	userID := uuid.Nil
	if uid := tenant.GetUserID(c); uid != nil {
		userID = *uid
	}
	if err := h.svc.DisconnectOAuthConnection(context.Background(), tid, id, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *connectorHandler) CreateAction(c *fiber.Ctx) error {
	var req api.CreateConnectorActionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	if err := h.v.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	connectorID, err := uuid.Parse(c.Params("connectorId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid connector id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	ctx := context.Background()
	action, err := h.svc.CreateAction(ctx, tid, connectorID, req.ActionName, req.HTTPMethod, req.Endpoint)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(api.APIResponse{Success: true, Data: action})
}

func (h *connectorHandler) ListActions(c *fiber.Ctx) error {
	connectorID, err := uuid.Parse(c.Params("connectorId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid connector id"})
	}
	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	ctx := context.Background()
	items, total, err := h.svc.ListActions(ctx, tid, connectorID, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: api.PagedResponse{Items: items, Total: total}})
}

func (h *connectorHandler) UpdateAction(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	var req api.UpdateConnectorActionRequest
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
	if req.ActionName != nil {
		updates["action_name"] = *req.ActionName
	}
	if req.HTTPMethod != nil {
		updates["http_method"] = *req.HTTPMethod
	}
	if req.Endpoint != nil {
		updates["endpoint"] = *req.Endpoint
	}
	if len(updates) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "no fields to update"})
	}
	ctx := context.Background()
	action, err := h.svc.UpdateAction(ctx, tid, id, updates)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: action})
}

func (h *connectorHandler) DeleteAction(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	ctx := context.Background()
	if err := h.svc.DeleteAction(ctx, tid, id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *connectorHandler) ListGoogleFiles(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	userID := uuid.Nil
	if uid := tenant.GetUserID(c); uid != nil {
		userID = *uid
	}
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	files, err := h.svc.ListGoogleSpreadsheets(context.Background(), tid, id, userID, c.Query("q"), limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: files})
}

func (h *connectorHandler) ListGoogleSheets(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	userID := uuid.Nil
	if uid := tenant.GetUserID(c); uid != nil {
		userID = *uid
	}
	sheets, err := h.svc.ListGoogleSheets(context.Background(), tid, id, userID, c.Query("spreadsheet_id"))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: sheets})
}

func (h *connectorHandler) PreviewGoogleSheet(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	userID := uuid.Nil
	if uid := tenant.GetUserID(c); uid != nil {
		userID = *uid
	}
	limit, _ := strconv.Atoi(c.Query("limit", "5"))
	preview, err := h.svc.PreviewGoogleSheet(context.Background(), tid, id, userID, c.Query("sheet"), limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: preview})
}

func isClientAuthConfigError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "auth_config") ||
		strings.Contains(msg, "invalid authentication_type") ||
		strings.Contains(msg, "invalid connector_type")
}
