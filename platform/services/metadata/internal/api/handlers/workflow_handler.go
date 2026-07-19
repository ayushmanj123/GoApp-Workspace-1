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

type workflowHandler struct {
	svc *services.WorkflowService
	v   *validator.Validate
}

func NewWorkflowHandler(store repositories.Store) *workflowHandler {
	return &workflowHandler{
		svc: services.NewWorkflowService(store),
		v:   validator.New(),
	}
}

// Service exposes the underlying workflow service (for scheduler wiring).
func (h *workflowHandler) Service() *services.WorkflowService {
	return h.svc
}

func (h *workflowHandler) Create(c *fiber.Ctx) error {
	var req api.CreateWorkflowRequest
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
	wf, err := h.svc.Create(context.Background(), tid, appID, req.Name, req.Definition)
	if err != nil {
		status := fiber.StatusInternalServerError
		if isWorkflowClientError(err) {
			status = fiber.StatusBadRequest
		}
		return c.Status(status).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(api.APIResponse{Success: true, Data: wf})
}

func (h *workflowHandler) List(c *fiber.Ctx) error {
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
	items, total, err := h.svc.ListByApplication(context.Background(), tid, appID, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: api.PagedResponse{Items: items, Total: total}})
}

func (h *workflowHandler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	wf, err := h.svc.Get(context.Background(), tid, id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: wf})
}

func (h *workflowHandler) Update(c *fiber.Ctx) error {
	var req api.UpdateWorkflowRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	wf, err := h.svc.Update(context.Background(), tid, id, req.Name, req.Definition)
	if err != nil {
		status := fiber.StatusInternalServerError
		if isWorkflowClientError(err) {
			status = fiber.StatusBadRequest
		}
		return c.Status(status).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: wf})
}

func (h *workflowHandler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	if err := h.svc.Delete(context.Background(), tid, id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *workflowHandler) Run(c *fiber.Ctx) error {
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
	run, err := h.svc.Run(context.Background(), tid, id, services.WorkflowRunOptions{
		TriggerSource: services.TriggerManual,
		UserID:        userID,
	})
	if err != nil {
		status := fiber.StatusInternalServerError
		if isWorkflowClientError(err) {
			status = fiber.StatusBadRequest
		}
		return c.Status(status).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: run})
}

func (h *workflowHandler) ListRuns(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	items, total, err := h.svc.ListRuns(context.Background(), tid, id, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: api.PagedResponse{Items: items, Total: total}})
}

func (h *workflowHandler) RotateWebhookSecret(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	tid, err := tenant.GetTenantID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: "tenant missing"})
	}
	token, err := h.svc.RotateWebhookSecret(context.Background(), tid, id)
	if err != nil {
		status := fiber.StatusInternalServerError
		if isWorkflowClientError(err) {
			status = fiber.StatusBadRequest
		}
		return c.Status(status).JSON(api.APIResponse{Success: false, Error: err.Error()})
	}
	return c.JSON(api.APIResponse{Success: true, Data: fiber.Map{
		"secret":     token,
		"hook_path":  "/api/v1/public/workflows/" + id.String() + "/hook",
		"auth_header": "Authorization: Bearer <secret>",
	}})
}

func (h *workflowHandler) PublicHook(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: "invalid id"})
	}
	authHeader := strings.TrimSpace(c.Get("Authorization"))
	token := ""
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		token = strings.TrimSpace(authHeader[7:])
	}
	body := c.Body()
	run, err := h.svc.RunWebhook(context.Background(), id, token, body)
	if err != nil {
		msg := err.Error()
		switch {
		case strings.Contains(msg, "unauthorized"):
			return c.Status(fiber.StatusUnauthorized).JSON(api.APIResponse{Success: false, Error: msg})
		case strings.Contains(msg, "not found"):
			return c.Status(fiber.StatusNotFound).JSON(api.APIResponse{Success: false, Error: msg})
		case strings.Contains(msg, "disabled"):
			return c.Status(fiber.StatusForbidden).JSON(api.APIResponse{Success: false, Error: msg})
		case strings.Contains(msg, "too large"):
			return c.Status(fiber.StatusRequestEntityTooLarge).JSON(api.APIResponse{Success: false, Error: msg})
		case isWorkflowClientError(err):
			return c.Status(fiber.StatusBadRequest).JSON(api.APIResponse{Success: false, Error: msg})
		default:
			return c.Status(fiber.StatusInternalServerError).JSON(api.APIResponse{Success: false, Error: msg})
		}
	}
	return c.JSON(api.APIResponse{Success: true, Data: run})
}

func isWorkflowClientError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "must be") ||
		strings.Contains(msg, "required") ||
		strings.Contains(msg, "invalid") ||
		strings.Contains(msg, "not found") ||
		strings.Contains(msg, "duplicate") ||
		strings.Contains(msg, "different application") ||
		strings.Contains(msg, "only rest") ||
		strings.Contains(msg, "connector_user_oauth_required") ||
		strings.Contains(msg, "cron") ||
		strings.Contains(msg, "timezone")
}
