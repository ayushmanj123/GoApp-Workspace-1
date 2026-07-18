package kernel

import (
	"errors"

	sharederrors "github.com/goapps-platform/shared/errors"
	"github.com/goapps-platform/runtime-service/internal/formula"
	"github.com/goapps-platform/runtime-service/internal/gallery"
	"github.com/goapps-platform/runtime-service/internal/state"
	"github.com/goapps-platform/shared/auth"
	"github.com/goapps-platform/shared/response"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)
// Service exposes runtime kernel HTTP endpoints.
type Service struct {
	kernel *RuntimeKernel
}

// NewService creates a kernel HTTP service.
func NewService(kernel *RuntimeKernel) *Service {
	return &Service{kernel: kernel}
}

// RegisterRoutes mounts runtime session and event endpoints.
func RegisterRoutes(router fiber.Router, svc *Service) {
	if svc == nil || svc.kernel == nil {
		return
	}
	router.Post("/runtime/session", svc.startSession)
	router.Post("/runtime/session/:sessionId/event", svc.handleControlEvent)
	router.Post("/runtime/session/:sessionId/evaluate", svc.evaluateFormula)
	router.Post("/runtime/session/:sessionId/gallery/:controlId/select", svc.selectGalleryItem)
}

func (s *Service) startSession(c *fiber.Ctx) error {
	requestID, _ := c.Locals("requestID").(string)
	identity, ok := auth.GetFiberAuthContext(c)
	if !ok || identity == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "authentication required")
	}

	var req StartSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return sharederrors.BadRequest("invalid request body")
	}
	if req.AppID == uuid.Nil {
		return sharederrors.BadRequest("appId is required")
	}
	c.Locals("appId", req.AppID.String())

	result, err := s.kernel.StartSession(c.Context(), identity.TenantID, identity.UserID, req)
	if err != nil {
		return mapKernelError(err)
	}
	return c.JSON(response.OK(result, requestID))
}

func (s *Service) handleControlEvent(c *fiber.Ctx) error {
	requestID, _ := c.Locals("requestID").(string)
	identity, ok := auth.GetFiberAuthContext(c)
	if !ok || identity == nil {
		return fiber.NewError(fiber.StatusUnauthorized, "authentication required")
	}

	sessionID, err := uuid.Parse(c.Params("sessionId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid sessionId")
	}

	var req ControlEventRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if stringsTrim(req.Event) == "" {
		return fiber.NewError(fiber.StatusBadRequest, "event is required")
	}
	if req.AppID == uuid.Nil {
		return fiber.NewError(fiber.StatusBadRequest, "appId is required")
	}
	_ = identity

	result, err := s.kernel.HandleControlEvent(c.Context(), sessionID, req)
	if err != nil {
		return mapKernelError(err)
	}
	return c.JSON(response.OK(result, requestID))
}

func (s *Service) evaluateFormula(c *fiber.Ctx) error {
	requestID, _ := c.Locals("requestID").(string)
	if _, ok := auth.GetFiberAuthContext(c); !ok {
		return fiber.NewError(fiber.StatusUnauthorized, "authentication required")
	}

	sessionID, err := uuid.Parse(c.Params("sessionId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid sessionId")
	}

	var req formula.SessionEvaluateRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if req.AppID == uuid.Nil {
		return fiber.NewError(fiber.StatusBadRequest, "appId is required")
	}
	if stringsTrim(req.Formula) == "" {
		return fiber.NewError(fiber.StatusBadRequest, "formula is required")
	}
	c.Locals("appId", req.AppID.String())

	result, refresh, err := s.kernel.EvaluateExpression(
		c.UserContext(),
		sessionID,
		req.Screen,
		req.Formula,
		req.Context,
	)
	if err != nil {
		return mapKernelError(err)
	}
	currentScreen := ""
	if session, ok := s.kernel.Session(sessionID); ok && session != nil {
		currentScreen = session.CurrentScreen
	}
	return c.JSON(response.OK(formula.EvaluateResponse{
		Result:        result,
		Refresh:       refresh,
		CurrentScreen: currentScreen,
	}, requestID))
}

func (s *Service) selectGalleryItem(c *fiber.Ctx) error {
	requestID, _ := c.Locals("requestID").(string)
	if _, ok := auth.GetFiberAuthContext(c); !ok {
		return fiber.NewError(fiber.StatusUnauthorized, "authentication required")
	}

	sessionID, err := uuid.Parse(c.Params("sessionId"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid sessionId")
	}

	var req gallerySelectRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if req.AppID == uuid.Nil {
		return fiber.NewError(fiber.StatusBadRequest, "appId is required")
	}

	selected, refresh, err := s.kernel.SelectGalleryItem(c.UserContext(), sessionID, c.Params("controlId"), req.Index)
	if err != nil {
		return mapKernelError(err)
	}
	return c.JSON(response.OK(map[string]interface{}{
		"controlId": c.Params("controlId"),
		"selected":  selected,
		"refresh":   refresh,
	}, requestID))
}

type gallerySelectRequest struct {
	AppID uuid.UUID `json:"appId"`
	Index int       `json:"index"`
}

func mapKernelError(err error) error {
	switch {
	case errors.Is(err, ErrSessionNotFound):
		return sharederrors.NotFound(err.Error())
	case errors.Is(err, ErrControlNotFound), errors.Is(err, ErrFormulaNotFound), errors.Is(err, gallery.ErrGalleryNotFound):
		return sharederrors.NotFound(err.Error())
	case errors.Is(err, ErrMetadataMissing):
		return sharederrors.New("SERVICE_UNAVAILABLE", err.Error(), 503)
	case errors.Is(err, ErrSessionLimit):
		return sharederrors.New("SESSION_LIMIT", err.Error(), 429)
	case errors.Is(err, state.ErrInvalidRequest):
		return sharederrors.BadRequest(err.Error())
	default:
		return sharederrors.Wrap(err, "INTERNAL_ERROR", "internal server error", 500)
	}
}

func stringsTrim(value string) string {
	for len(value) > 0 && (value[0] == ' ' || value[0] == '\t' || value[0] == '\n' || value[0] == '\r') {
		value = value[1:]
	}
	for len(value) > 0 {
		last := value[len(value)-1]
		if last != ' ' && last != '\t' && last != '\n' && last != '\r' {
			break
		}
		value = value[:len(value)-1]
	}
	return value
}
