package renderer

import (
	"errors"
	"strings"

	"github.com/goapps-platform/runtime-service/internal/properties"
	"github.com/goapps-platform/shared/auth"
	"github.com/goapps-platform/shared/response"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

var ErrSessionNotFound = errors.New("runtime session not found")

// Handler exposes screen render HTTP endpoints.
type Handler struct {
	engine  *Engine
	session SessionLookup
}

// SessionLookup resolves runtime sessions for render APIs.
type SessionLookup interface {
	RenderSession(sessionID uuid.UUID) (uuid.UUID, SessionAccess, error)
}

func NewHandler(engine *Engine, session SessionLookup) *Handler {
	return &Handler{engine: engine, session: session}
}

func RegisterRoutes(router fiber.Router, handler *Handler) {
	if handler == nil || handler.engine == nil {
		return
	}
	router.Get("/runtime/session/:sessionId/render/:screenId", handler.GetScreenRender)
}

func (h *Handler) GetScreenRender(c *fiber.Ctx) error {
	requestID, _ := c.Locals("requestID").(string)
	if _, err := requireAuth(c); err != nil {
		return err
	}
	sessionID, err := uuid.Parse(c.Params("sessionId"))
	if err != nil {
		return badRequest(c, "invalid sessionId")
	}
	_, access, err := h.session.RenderSession(sessionID)
	if err != nil {
		return mapHandlerError(c, err)
	}

	screenID := c.Params("screenId")
	controlFilter := parseControlFilter(c.Query("controls"))
	var result Screen
	if len(controlFilter) > 0 {
		result, err = h.engine.RenderControls(c.UserContext(), access, sessionID, screenID, controlFilter)
	} else {
		result, err = h.engine.RenderScreen(c.UserContext(), access, sessionID, screenID)
	}
	if err != nil {
		return mapHandlerError(c, err)
	}
	return c.JSON(response.OK(result, requestID))
}

func parseControlFilter(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	controls := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			controls = append(controls, part)
		}
	}
	return controls
}

func requireAuth(c *fiber.Ctx) (*auth.AuthContext, error) {
	ac, ok := auth.GetFiberAuthContext(c)
	if !ok || ac == nil || !ac.IsAuthenticated {
		return nil, c.Status(fiber.StatusUnauthorized).JSON(response.Fail("UNAUTHORIZED", "authentication required", requestID(c)))
	}
	return ac, nil
}

func mapHandlerError(c *fiber.Ctx, err error) error {
	if errors.Is(err, properties.ErrControlNotFound) || errors.Is(err, ErrSessionNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(response.Fail("NOT_FOUND", err.Error(), requestID(c)))
	}
	return c.Status(fiber.StatusInternalServerError).JSON(response.Fail("INTERNAL_ERROR", err.Error(), requestID(c)))
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
