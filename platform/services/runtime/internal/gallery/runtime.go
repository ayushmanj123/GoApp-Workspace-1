package gallery

import (
	"errors"

	"github.com/goapps-platform/shared/auth"
	"github.com/goapps-platform/shared/response"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// SessionLookup resolves a runtime session for gallery APIs.
type SessionLookup interface {
	GalleryControl(sessionID uuid.UUID, controlID string) (ControlMetadata, uuid.UUID, uuid.UUID, uuid.UUID, error)
	GalleryControls(sessionID uuid.UUID) ([]ControlMetadata, uuid.UUID, uuid.UUID, uuid.UUID, error)
}

// Handler exposes gallery runtime HTTP endpoints.
type Handler struct {
	svc     *Service
	session SessionLookup
}

func NewHandler(svc *Service, session SessionLookup) *Handler {
	return &Handler{svc: svc, session: session}
}

// RegisterRoutes mounts gallery endpoints on the runtime API router.
func RegisterRoutes(router fiber.Router, handler *Handler) {
	if handler == nil || handler.svc == nil {
		return
	}
	router.Get("/runtime/session/:sessionId/gallery/:controlId", handler.GetGallery)
}

type GalleryResponse struct {
	ControlID string                   `json:"controlId"`
	Source    string                   `json:"source,omitempty"`
	Items     []map[string]interface{} `json:"items"`
	Selected  map[string]interface{}   `json:"selected,omitempty"`
	Count     int                      `json:"count"`
}

func (h *Handler) GetGallery(c *fiber.Ctx) error {
	requestID, _ := c.Locals("requestID").(string)
	if _, err := requireAuth(c); err != nil {
		return err
	}
	sessionID, err := uuid.Parse(c.Params("sessionId"))
	if err != nil {
		return badRequest(c, "invalid sessionId")
	}
	controlID := c.Params("controlId")
	control, tenantID, userID, appID, err := h.session.GalleryControl(sessionID, controlID)
	if err != nil {
		return mapHandlerError(c, err)
	}

	state, err := h.svc.Get(sessionID, control.Name)
	if errors.Is(err, ErrGalleryNotFound) {
		state, err = h.svc.Load(c.UserContext(), sessionID, tenantID, userID, appID, control)
	}
	if err != nil {
		return mapHandlerError(c, err)
	}
	return c.JSON(response.OK(GalleryResponse{
		ControlID: control.Name,
		Source:    state.Source,
		Items:     state.Items,
		Selected:  state.Selected,
		Count:     len(state.Items),
	}, requestID))
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
	case errors.Is(err, ErrGalleryNotFound):
		return c.Status(fiber.StatusNotFound).JSON(response.Fail("NOT_FOUND", err.Error(), requestID(c)))
	case errors.Is(err, ErrInvalidSelect):
		return c.Status(fiber.StatusBadRequest).JSON(response.Fail("BAD_REQUEST", err.Error(), requestID(c)))
	default:
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
