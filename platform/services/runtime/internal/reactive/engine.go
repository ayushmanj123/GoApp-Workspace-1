package reactive

import (
	"strings"

	runtimemetrics "github.com/goapps-platform/runtime-service/internal/metrics"
	"github.com/goapps-platform/shared/auth"
	"github.com/goapps-platform/shared/response"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// Engine coordinates event publishing, subscriptions, and targeted refresh resolution.
type Engine struct {
	bus      *Dispatcher
	Notifier *Notifier
}

// NewEngine creates a reactive runtime engine.
func NewEngine() *Engine {
	bus := NewDispatcher()
	return &Engine{
		bus:      bus,
		Notifier: NewNotifier(bus),
	}
}

// RegisterDependencies stores control dependency metadata for a session.
func (e *Engine) RegisterDependencies(sessionID uuid.UUID, controls []ControlDependency) {
	e.bus.RegisterDependencies(sessionID, controls)
}

// Dependencies returns registered control dependencies for a session.
func (e *Engine) Dependencies(sessionID uuid.UUID) []ControlDependency {
	return e.bus.Dependencies(sessionID)
}

// Publish emits an event and returns the queued notification.
func (e *Engine) Publish(event Event) (notification QueuedNotification) {
	_ = runtimemetrics.TimeReactive("publish", func() error {
		notification = e.bus.Publish(event)
		return nil
	})
	return notification
}

// Poll drains pending notifications for a session.
func (e *Engine) Poll(sessionID uuid.UUID) []QueuedNotification {
	return e.bus.Poll(sessionID)
}

// CalculateRefresh resolves refresh instructions without enqueueing an event.
func (e *Engine) CalculateRefresh(sessionID uuid.UUID, event Event) RefreshResponse {
	return RefreshResponse{Refresh: resolveRefresh(e.bus.Dependencies(sessionID), event)}
}

// ClearSession removes reactive state for an expired runtime session.
func (e *Engine) ClearSession(sessionID uuid.UUID) {
	if e == nil || e.bus == nil {
		return
	}
	e.bus.ClearSession(sessionID)
}

// NavigationService publishes NavigationRequested events without performing UI navigation.
type NavigationService struct {
	Publisher  Publisher
	SessionID  uuid.UUID
	AppID      uuid.UUID
	OnNavigate func(RefreshResponse)
}

func (s *NavigationService) Navigate(screenName string) error {
	if s != nil && s.Publisher != nil {
		resp := s.Publisher.NavigationRequested(s.SessionID, s.AppID, strings.TrimSpace(screenName))
		if s.OnNavigate != nil {
			s.OnNavigate(resp)
		}
	}
	return nil
}

// Service exposes reactive HTTP endpoints.
type Service struct {
	engine *Engine
}

func NewService(engine *Engine) *Service {
	return &Service{engine: engine}
}

// RegisterRoutes mounts reactive event endpoints.
func RegisterRoutes(router fiber.Router, svc *Service) {
	router.Post("/runtime/events/subscribe", svc.Subscribe)
	router.Post("/runtime/events/publish", svc.Publish)
	router.Get("/runtime/events/poll/:sessionId", svc.Poll)
}

func (s *Service) Subscribe(c *fiber.Ctx) error {
	if _, err := requireAuth(c); err != nil {
		return err
	}
	var req SubscribeRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "invalid request body")
	}
	if req.AppID == uuid.Nil || req.SessionID == uuid.Nil {
		return badRequest(c, "appId and sessionId are required")
	}
	if len(req.Controls) == 0 {
		return badRequest(c, "controls are required")
	}

	subscriptionID := s.engine.bus.Subscribe(req.SessionID, req.Controls)
	return c.JSON(response.OK(map[string]string{"subscriptionId": subscriptionID}, requestID(c)))
}

func (s *Service) Publish(c *fiber.Ctx) error {
	if _, err := requireAuth(c); err != nil {
		return err
	}
	var req PublishRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "invalid request body")
	}
	if req.AppID == uuid.Nil || req.SessionID == uuid.Nil {
		return badRequest(c, "appId and sessionId are required")
	}
	if strings.TrimSpace(string(req.Type)) == "" {
		return badRequest(c, "type is required")
	}

	notification := s.engine.Publish(Event{
		SessionID: req.SessionID,
		AppID:     req.AppID,
		Type:      req.Type,
		Payload:   req.Payload,
	})
	return c.JSON(response.OK(PublishResponse{Event: notification.Event, Refresh: notification.Refresh}, requestID(c)))
}

func (s *Service) Poll(c *fiber.Ctx) error {
	if _, err := requireAuth(c); err != nil {
		return err
	}
	sessionID, err := uuid.Parse(c.Params("sessionId"))
	if err != nil {
		return badRequest(c, "invalid session id")
	}
	return c.JSON(response.OK(PollResponse{Events: s.engine.Poll(sessionID)}, requestID(c)))
}

func requireAuth(c *fiber.Ctx) (*auth.AuthContext, error) {
	ac, ok := auth.GetFiberAuthContext(c)
	if !ok || ac == nil || !ac.IsAuthenticated {
		return nil, c.Status(fiber.StatusUnauthorized).JSON(response.Fail("UNAUTHORIZED", "authentication required", requestID(c)))
	}
	return ac, nil
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

// MergeRefresh combines refresh instructions without duplicate control IDs.
func MergeRefresh(items ...RefreshResponse) []RefreshInstruction {
	seen := map[string]RefreshInstruction{}
	for _, batch := range items {
		for _, item := range batch.Refresh {
			if existing, ok := seen[item.ControlID]; ok {
				if existing.Reason == "" {
					existing.Reason = item.Reason
				}
				seen[item.ControlID] = existing
				continue
			}
			seen[item.ControlID] = item
		}
	}
	out := make([]RefreshInstruction, 0, len(seen))
	for _, item := range seen {
		out = append(out, item)
	}
	return out
}
