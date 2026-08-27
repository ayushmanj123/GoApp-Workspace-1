package form

import (
	"errors"

	"github.com/goapps-platform/runtime-service/internal/records"
	"github.com/goapps-platform/shared/auth"
	"github.com/goapps-platform/shared/response"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// SessionLookup resolves runtime session context for form APIs.
type SessionLookup interface {
	FormControl(sessionID uuid.UUID, controlID string) (ControlMetadata, uuid.UUID, uuid.UUID, uuid.UUID, error)
}

// Handler exposes form runtime HTTP endpoints.
type Handler struct {
	svc     *Service
	session SessionLookup
}

func NewHandler(svc *Service, session SessionLookup) *Handler {
	return &Handler{svc: svc, session: session}
}

// RegisterRoutes mounts form endpoints on the runtime API router.
func RegisterRoutes(router fiber.Router, handler *Handler) {
	if handler == nil || handler.svc == nil {
		return
	}
	router.Get("/runtime/session/:sessionId/form/:controlId", handler.GetForm)
	router.Post("/runtime/session/:sessionId/form/:controlId/mode", handler.SetMode)
	router.Post("/runtime/session/:sessionId/form/:controlId/update", handler.UpdateForm)
	router.Post("/runtime/session/:sessionId/form/:controlId/submit", handler.SubmitForm)
	router.Post("/runtime/session/:sessionId/form/:controlId/reset", handler.ResetForm)
}

type FormResponse struct {
	ControlID        string                 `json:"controlId"`
	Mode             Mode                   `json:"mode"`
	CurrentRecord    map[string]interface{} `json:"currentRecord"`
	OriginalRecord   map[string]interface{} `json:"originalRecord,omitempty"`
	DirtyFields      map[string]interface{} `json:"dirtyFields,omitempty"`
	Updates          map[string]interface{} `json:"updates,omitempty"`
	ValidationErrors []ValidationIssue      `json:"validationErrors,omitempty"`
	LastSubmit       map[string]interface{} `json:"lastSubmit,omitempty"`
	Error            *FormError             `json:"error,omitempty"`
	DataSource       string                 `json:"dataSource,omitempty"`
	Unsaved          bool                   `json:"unsaved"`
	Valid            bool                   `json:"valid"`
}

type modeRequest struct {
	AppID uuid.UUID `json:"appId"`
	Mode  string    `json:"mode"`
}

type updateRequest struct {
	AppID  uuid.UUID              `json:"appId"`
	Fields map[string]interface{} `json:"fields"`
}

type appRequest struct {
	AppID uuid.UUID `json:"appId"`
}

func (h *Handler) GetForm(c *fiber.Ctx) error {
	requestID, _ := c.Locals("requestID").(string)
	if _, err := requireAuth(c); err != nil {
		return err
	}
	sessionID, err := uuid.Parse(c.Params("sessionId"))
	if err != nil {
		return badRequest(c, "invalid sessionId")
	}
	control, tenantID, userID, appID, err := h.session.FormControl(sessionID, c.Params("controlId"))
	if err != nil {
		return mapHandlerError(c, err)
	}
	state, err := h.svc.Get(sessionID, control.Name)
	if errors.Is(err, ErrFormNotFound) {
		state, err = h.svc.Load(c.UserContext(), sessionID, tenantID, userID, appID, control)
	}
	if err != nil {
		return mapHandlerError(c, err)
	}
	return c.JSON(response.OK(toFormResponse(control.Name, state), requestID))
}

func (h *Handler) SetMode(c *fiber.Ctx) error {
	requestID, _ := c.Locals("requestID").(string)
	if _, err := requireAuth(c); err != nil {
		return err
	}
	sessionID, err := uuid.Parse(c.Params("sessionId"))
	if err != nil {
		return badRequest(c, "invalid sessionId")
	}
	var req modeRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "invalid request body")
	}
	if req.AppID == uuid.Nil {
		return badRequest(c, "appId is required")
	}
	control, tenantID, _, appID, err := h.session.FormControl(sessionID, c.Params("controlId"))
	if err != nil {
		return mapHandlerError(c, err)
	}
	state, err := h.svc.SetMode(c.UserContext(), sessionID, tenantID, appID, control, parseMode(req.Mode))
	if err != nil {
		return mapHandlerError(c, err)
	}
	return c.JSON(response.OK(toFormResponse(control.Name, state), requestID))
}

func (h *Handler) UpdateForm(c *fiber.Ctx) error {
	requestID, _ := c.Locals("requestID").(string)
	if _, err := requireAuth(c); err != nil {
		return err
	}
	sessionID, err := uuid.Parse(c.Params("sessionId"))
	if err != nil {
		return badRequest(c, "invalid sessionId")
	}
	var req updateRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "invalid request body")
	}
	if req.AppID == uuid.Nil {
		return badRequest(c, "appId is required")
	}
	control, tenantID, _, appID, err := h.session.FormControl(sessionID, c.Params("controlId"))
	if err != nil {
		return mapHandlerError(c, err)
	}
	state, err := h.svc.Update(c.UserContext(), sessionID, tenantID, appID, control, req.Fields)
	if err != nil {
		return mapHandlerError(c, err)
	}
	return c.JSON(response.OK(toFormResponse(control.Name, state), requestID))
}

func (h *Handler) SubmitForm(c *fiber.Ctx) error {
	requestID, _ := c.Locals("requestID").(string)
	if _, err := requireAuth(c); err != nil {
		return err
	}
	sessionID, err := uuid.Parse(c.Params("sessionId"))
	if err != nil {
		return badRequest(c, "invalid sessionId")
	}
	var req appRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "invalid request body")
	}
	if req.AppID == uuid.Nil {
		return badRequest(c, "appId is required")
	}
	control, tenantID, userID, appID, err := h.session.FormControl(sessionID, c.Params("controlId"))
	if err != nil {
		return mapHandlerError(c, err)
	}
	state, dataSource, err := h.svc.Submit(c.UserContext(), sessionID, tenantID, userID, appID, control)
	if err != nil {
		return mapHandlerError(c, err)
	}
	return c.JSON(response.OK(map[string]interface{}{
		"form":       toFormResponse(control.Name, state),
		"dataSource": dataSource,
	}, requestID))
}

func (h *Handler) ResetForm(c *fiber.Ctx) error {
	requestID, _ := c.Locals("requestID").(string)
	if _, err := requireAuth(c); err != nil {
		return err
	}
	sessionID, err := uuid.Parse(c.Params("sessionId"))
	if err != nil {
		return badRequest(c, "invalid sessionId")
	}
	var req appRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "invalid request body")
	}
	if req.AppID == uuid.Nil {
		return badRequest(c, "appId is required")
	}
	control, tenantID, _, appID, err := h.session.FormControl(sessionID, c.Params("controlId"))
	if err != nil {
		return mapHandlerError(c, err)
	}
	state, err := h.svc.Reset(c.UserContext(), sessionID, tenantID, appID, control)
	if err != nil {
		return mapHandlerError(c, err)
	}
	return c.JSON(response.OK(toFormResponse(control.Name, state), requestID))
}

func toFormResponse(controlID string, state *State) FormResponse {
	if state == nil {
		return FormResponse{ControlID: controlID}
	}
	return FormResponse{
		ControlID:        controlID,
		Mode:             state.Mode,
		CurrentRecord:    state.CurrentRecord,
		OriginalRecord:   state.OriginalRecord,
		DirtyFields:      state.DirtyFields,
		Updates:          state.DirtyFields,
		ValidationErrors: state.ValidationErrors,
		LastSubmit:       state.LastSubmit,
		Error:            state.LastError,
		DataSource:       state.DataSource,
		Unsaved:          len(state.DirtyFields) > 0,
		Valid:            len(state.ValidationErrors) == 0,
	}
}

func requireAuth(c *fiber.Ctx) (*auth.AuthContext, error) {
	ac, ok := auth.GetFiberAuthContext(c)
	if !ok || ac == nil || !ac.IsAuthenticated {
		return nil, c.Status(fiber.StatusUnauthorized).JSON(response.Fail("UNAUTHORIZED", "authentication required", requestID(c)))
	}
	return ac, nil
}

func mapHandlerError(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, ErrFormNotFound):
		return c.Status(fiber.StatusNotFound).JSON(response.Fail("NOT_FOUND", err.Error(), requestID(c)))
	case errors.Is(err, ErrInvalidMode), errors.Is(err, ErrRecordUnavailable), errors.Is(err, ErrStorageEditMode):
		return c.Status(fiber.StatusBadRequest).JSON(response.Fail("BAD_REQUEST", err.Error(), requestID(c)))
	case errors.Is(err, ErrValidationFailed):
		return c.Status(fiber.StatusBadRequest).JSON(response.Fail("VALIDATION_FAILED", err.Error(), requestID(c)))
	default:
		var validationErr *records.ValidationError
		if errors.As(err, &validationErr) {
			return c.Status(fiber.StatusBadRequest).JSON(response.Fail("VALIDATION_FAILED", err.Error(), requestID(c)))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(response.Fail("INTERNAL_ERROR", err.Error(), requestID(c)))
	}
}

func badRequest(c *fiber.Ctx, message string) error {
	return c.Status(fiber.StatusBadRequest).JSON(response.Fail("BAD_REQUEST", message, requestID(c)))
}

func requestID(c *fiber.Ctx) string {
	if id, ok := c.Locals("requestID").(string); ok {
		return id
	}
	return ""
}
