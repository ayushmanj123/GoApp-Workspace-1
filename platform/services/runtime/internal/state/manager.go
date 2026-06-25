package state

import (
	"errors"
	"strings"

	"github.com/goapps-platform/shared/auth"
	"github.com/goapps-platform/shared/response"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type memoryStateManager struct {
	appID     uuid.UUID
	sessionID uuid.UUID
	state     *sessionState
}

func (m *memoryStateManager) GetVariable(name string) (any, bool) {
	return m.state.getVariable(name)
}

func (m *memoryStateManager) SetVariable(name string, value any) {
	m.state.setVariable(name, value)
}

func (m *memoryStateManager) UpdateVariable(name string, value any) error {
	return m.state.updateVariable(name, value)
}

func (m *memoryStateManager) DeleteVariable(name string) error {
	return m.state.deleteVariable(name)
}

func (m *memoryStateManager) GetContext(screen, name string) (any, bool) {
	return m.state.getContext(screen, name)
}

func (m *memoryStateManager) SetContext(screen, name string, value any) {
	m.state.setContext(screen, name, value)
}

func (m *memoryStateManager) UpdateContext(screen string, values map[string]any) {
	m.state.updateContext(screen, values)
}

func (m *memoryStateManager) GetCollection(name string) []any {
	return m.state.getCollection(name)
}

func (m *memoryStateManager) SetCollection(name string, items []any) {
	m.state.setCollection(name, items)
}

func (m *memoryStateManager) ClearCollection(name string) {
	m.state.clearCollection(name)
}

func (m *memoryStateManager) Collect(collection string, item any) {
	m.state.collect(collection, item)
}

func (m *memoryStateManager) Clear(collection string) {
	m.state.clear(collection)
}

func (m *memoryStateManager) ClearCollect(collection string, items []any) {
	m.state.clearCollect(collection, items)
}

func (m *memoryStateManager) First(collection string) (any, bool) {
	return m.state.first(collection)
}

func (m *memoryStateManager) Last(collection string) (any, bool) {
	return m.state.last(collection)
}

func (m *memoryStateManager) CountRows(collection string) int {
	return m.state.countRows(collection)
}

func (m *memoryStateManager) Snapshot() RuntimeState {
	return RuntimeState{
		AppID:            m.appID,
		SessionID:        m.sessionID,
		GlobalVariables:  m.state.snapshotVariables(),
		ContextVariables: m.state.snapshotContext(),
		Collections:      m.state.snapshotCollections(),
	}
}

// Service exposes runtime state operations over HTTP.
type Service struct {
	store *MemoryStore
}

func NewService(store *MemoryStore) *Service {
	return &Service{store: store}
}

// RegisterRoutes mounts runtime state HTTP endpoints.
func RegisterRoutes(router fiber.Router, svc *Service) {
	router.Post("/runtime/state/sessions", svc.CreateSession)
	router.Get("/runtime/state/:sessionId", svc.GetSnapshot)
	router.Post("/runtime/state/:sessionId/variables", svc.SetVariable)
	router.Post("/runtime/state/:sessionId/collections", svc.MutateCollection)
	router.Delete("/runtime/state/:sessionId/collections/:name", svc.DeleteCollection)
	router.Post("/runtime/state/:sessionId/context/:screen", svc.UpdateContext)
}

func (s *Service) CreateSession(c *fiber.Ctx) error {
	if _, err := requireAuth(c); err != nil {
		return err
	}
	var req CreateSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "invalid request body")
	}
	if req.AppID == uuid.Nil {
		return badRequest(c, "appId is required")
	}

	sessionID := s.store.CreateSession(req.AppID)
	return c.Status(fiber.StatusCreated).JSON(response.OK(CreateSessionResponse{
		SessionID: sessionID,
		AppID:     req.AppID,
	}, requestID(c)))
}

func (s *Service) GetSnapshot(c *fiber.Ctx) error {
	if _, err := requireAuth(c); err != nil {
		return err
	}
	sessionID, appID, err := parseSessionRequest(c)
	if err != nil {
		return badRequest(c, err.Error())
	}

	manager, err := s.store.GetManager(appID, sessionID)
	if err != nil {
		return mapServiceError(c, err)
	}
	return c.JSON(response.OK(manager.Snapshot(), requestID(c)))
}

func (s *Service) SetVariable(c *fiber.Ctx) error {
	if _, err := requireAuth(c); err != nil {
		return err
	}
	sessionID, err := uuid.Parse(c.Params("sessionId"))
	if err != nil {
		return badRequest(c, "invalid session id")
	}

	var req SetVariableRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "invalid request body")
	}
	if req.AppID == uuid.Nil {
		return badRequest(c, "appId is required")
	}
	if err := validateName(req.Name); err != nil {
		return badRequest(c, err.Error())
	}

	manager, err := s.store.GetManager(req.AppID, sessionID)
	if err != nil {
		return mapServiceError(c, err)
	}

	if existing, ok := manager.GetVariable(req.Name); ok {
		_ = existing
		if err := manager.UpdateVariable(req.Name, req.Value); err != nil {
			return mapServiceError(c, err)
		}
	} else {
		manager.SetVariable(req.Name, req.Value)
	}

	return c.JSON(response.OK(manager.Snapshot(), requestID(c)))
}

func (s *Service) MutateCollection(c *fiber.Ctx) error {
	if _, err := requireAuth(c); err != nil {
		return err
	}
	sessionID, err := uuid.Parse(c.Params("sessionId"))
	if err != nil {
		return badRequest(c, "invalid session id")
	}

	var req CollectionActionRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "invalid request body")
	}
	if req.AppID == uuid.Nil {
		return badRequest(c, "appId is required")
	}
	if err := validateName(req.Name); err != nil {
		return badRequest(c, err.Error())
	}

	manager, err := s.store.GetManager(req.AppID, sessionID)
	if err != nil {
		return mapServiceError(c, err)
	}

	switch strings.ToLower(strings.TrimSpace(req.Action)) {
	case "collect":
		manager.Collect(req.Name, req.Item)
	case "clear":
		manager.Clear(req.Name)
	case "clearcollect":
		manager.ClearCollect(req.Name, req.Items)
	case "set":
		manager.SetCollection(req.Name, req.Items)
	default:
		return badRequest(c, "action must be collect, clear, clearCollect, or set")
	}

	return c.JSON(response.OK(manager.Snapshot(), requestID(c)))
}

func (s *Service) DeleteCollection(c *fiber.Ctx) error {
	if _, err := requireAuth(c); err != nil {
		return err
	}
	sessionID, appID, err := parseSessionRequest(c)
	if err != nil {
		return badRequest(c, err.Error())
	}
	name := c.Params("name")
	if err := validateName(name); err != nil {
		return badRequest(c, err.Error())
	}

	manager, err := s.store.GetManager(appID, sessionID)
	if err != nil {
		return mapServiceError(c, err)
	}
	manager.ClearCollection(name)
	return c.JSON(response.OK(manager.Snapshot(), requestID(c)))
}

func (s *Service) UpdateContext(c *fiber.Ctx) error {
	if _, err := requireAuth(c); err != nil {
		return err
	}
	sessionID, err := uuid.Parse(c.Params("sessionId"))
	if err != nil {
		return badRequest(c, "invalid session id")
	}
	screen := c.Params("screen")
	if err := validateScreen(screen); err != nil {
		return badRequest(c, err.Error())
	}

	var req UpdateContextRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "invalid request body")
	}
	if req.AppID == uuid.Nil {
		return badRequest(c, "appId is required")
	}
	if len(req.Values) == 0 {
		return badRequest(c, "values are required")
	}

	manager, err := s.store.GetManager(req.AppID, sessionID)
	if err != nil {
		return mapServiceError(c, err)
	}
	manager.UpdateContext(screen, req.Values)
	return c.JSON(response.OK(manager.Snapshot(), requestID(c)))
}

func parseSessionRequest(c *fiber.Ctx) (uuid.UUID, uuid.UUID, error) {
	sessionID, err := uuid.Parse(c.Params("sessionId"))
	if err != nil {
		return uuid.Nil, uuid.Nil, errors.New("invalid session id")
	}
	appID, err := uuid.Parse(c.Query("appId"))
	if err != nil || appID == uuid.Nil {
		return uuid.Nil, uuid.Nil, errors.New("appId query parameter is required")
	}
	return sessionID, appID, nil
}

func requireAuth(c *fiber.Ctx) (*auth.AuthContext, error) {
	ac, ok := auth.GetFiberAuthContext(c)
	if !ok || ac == nil || !ac.IsAuthenticated {
		return nil, c.Status(fiber.StatusUnauthorized).JSON(response.Fail("UNAUTHORIZED", "authentication required", requestID(c)))
	}
	return ac, nil
}

func mapServiceError(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, ErrSessionNotFound):
		return c.Status(fiber.StatusNotFound).JSON(response.Fail("NOT_FOUND", err.Error(), requestID(c)))
	case errors.Is(err, ErrVariableNotFound):
		return c.Status(fiber.StatusNotFound).JSON(response.Fail("NOT_FOUND", err.Error(), requestID(c)))
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
