package properties

import (
	"context"
	"errors"
	"strings"
	"sync"

	"github.com/goapps-platform/runtime-service/internal/reactive"
	runtimemetrics "github.com/goapps-platform/runtime-service/internal/metrics"
	"github.com/goapps-platform/shared/auth"
	"github.com/goapps-platform/shared/response"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

var ErrControlNotFound = errors.New("control not found")

// Engine evaluates control properties using the shared formula runtime.
type Engine struct {
	evaluator    *PropertyEvaluator
	cache        *Cache
	reactive     *reactive.Engine
	mu           sync.RWMutex
	dependencies map[uuid.UUID][]PropertyDependency
}

func NewEngine(formula FormulaEvaluator, reactiveEngine *reactive.Engine) *Engine {
	return &Engine{
		evaluator:    NewPropertyEvaluator(formula),
		cache:        NewCache(),
		reactive:     reactiveEngine,
		dependencies: map[uuid.UUID][]PropertyDependency{},
	}
}

func (e *Engine) ClearSession(sessionID uuid.UUID) {
	if e == nil {
		return
	}
	e.cache.ClearSession(sessionID)
	e.mu.Lock()
	delete(e.dependencies, sessionID)
	e.mu.Unlock()
}

func (e *Engine) RegisterDependencies(sessionID uuid.UUID, controls []ControlDefinition) {
	if e == nil {
		return
	}
	merged := MergeControlDependencies(controls)
	if e.reactive != nil {
		e.reactive.RegisterDependencies(sessionID, merged)
	}
	propertyDeps := make([]PropertyDependency, 0)
	for _, control := range controls {
		propertyDeps = append(propertyDeps, AnalyzeControlDependencies(control)...)
	}
	e.mu.Lock()
	e.dependencies[sessionID] = propertyDeps
	e.mu.Unlock()
}

func (e *Engine) InvalidateControl(sessionID uuid.UUID, controlID string) {
	if e == nil {
		return
	}
	e.cache.InvalidateControl(sessionID, controlID)
}

func (e *Engine) InvalidateEvent(sessionID uuid.UUID, event reactive.Event) {
	if e == nil {
		return
	}
	e.mu.RLock()
	deps := e.dependencies[sessionID]
	e.mu.RUnlock()
	e.cache.InvalidateEvent(sessionID, event, deps)
}

func (e *Engine) EvaluateControl(ctx context.Context, session SessionAccess, sessionID uuid.UUID, controlID string) (EvaluatedControl, error) {
	control, ok := session.Control(controlID)
	if !ok {
		return EvaluatedControl{}, ErrControlNotFound
	}
	properties := map[string]interface{}{}
	for name, binding := range ResolveBindings(control) {
		value, err := e.evaluateProperty(sessionID, control.Name, name, binding, session.FormulaContext())
		if err != nil {
			continue
		}
		properties[name] = value
	}
	applyRenderDefaults(properties)
	return EvaluatedControl{ControlID: control.Name, Properties: properties}, nil
}

func (e *Engine) EvaluateProperty(ctx context.Context, session SessionAccess, sessionID uuid.UUID, controlID, propertyName string) (interface{}, error) {
	control, ok := session.Control(controlID)
	if !ok {
		return nil, ErrControlNotFound
	}
	bindings := ResolveBindings(control)
	binding, ok := bindings[normalizePropertyName(propertyName)]
	if !ok {
		return nil, nil
	}
	return e.evaluateProperty(sessionID, control.Name, binding.Name, binding, session.FormulaContext())
}

func (e *Engine) EvaluateScreen(ctx context.Context, session SessionAccess, sessionID uuid.UUID, screenID string) (evaluated EvaluatedScreen, err error) {
	err = runtimemetrics.TimeProperty("evaluate_screen", func() error {
		controls := session.ControlsOnScreen(screenID)
		items := make([]EvaluatedControl, 0, len(controls))
		for _, control := range controls {
			item, evalErr := e.EvaluateControl(ctx, session, sessionID, control.Name)
			if evalErr != nil {
				return evalErr
			}
			items = append(items, item)
		}
		evaluated = EvaluatedScreen{ScreenID: screenID, Controls: items}
		return nil
	})
	return evaluated, err
}

func (e *Engine) evaluateProperty(sessionID uuid.UUID, controlID, propertyName string, binding Binding, rtCtx any) (interface{}, error) {
	if cached, ok := e.cache.Get(sessionID, controlID, propertyName); ok {
		return cached, nil
	}
	value, err := e.evaluator.Evaluate(binding, rtCtx)
	if err != nil {
		return nil, err
	}
	normalized := normalizeEvaluatedValue(value)
	e.cache.Set(sessionID, controlID, propertyName, normalized)
	return normalized, nil
}

// SessionLookup resolves runtime sessions for property APIs.
type SessionLookup interface {
	PropertySession(sessionID uuid.UUID) (uuid.UUID, SessionAccess, error)
}

// Handler exposes property evaluation HTTP endpoints.
type Handler struct {
	engine  *Engine
	session SessionLookup
}

func NewHandler(engine *Engine, session SessionLookup) *Handler {
	return &Handler{engine: engine, session: session}
}

func RegisterRoutes(router fiber.Router, handler *Handler) {
	if handler == nil || handler.engine == nil {
		return
	}
	router.Get("/runtime/session/:sessionId/properties/:controlId", handler.GetControlProperties)
}

func (h *Handler) GetControlProperties(c *fiber.Ctx) error {
	requestID, _ := c.Locals("requestID").(string)
	if _, err := requireAuth(c); err != nil {
		return err
	}
	sessionID, err := uuid.Parse(c.Params("sessionId"))
	if err != nil {
		return badRequest(c, "invalid sessionId")
	}
	_, access, err := h.session.PropertySession(sessionID)
	if err != nil {
		return mapHandlerError(c, err)
	}
	result, err := h.engine.EvaluateControl(c.UserContext(), access, sessionID, c.Params("controlId"))
	if err != nil {
		return mapHandlerError(c, err)
	}
	return c.JSON(response.OK(result, requestID))
}

func requireAuth(c *fiber.Ctx) (*auth.AuthContext, error) {
	ac, ok := auth.GetFiberAuthContext(c)
	if !ok || ac == nil || !ac.IsAuthenticated {
		return nil, c.Status(fiber.StatusUnauthorized).JSON(response.Fail("UNAUTHORIZED", "authentication required", requestID(c)))
	}
	return ac, nil
}

func mapHandlerError(c *fiber.Ctx, err error) error {
	if errors.Is(err, ErrControlNotFound) {
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

// FormulaEvaluatorAdapter adapts a typed formula evaluator.
type FormulaEvaluatorAdapter struct {
	EvaluateFunc func(rtCtx any, formula string) (any, error)
}

func (a FormulaEvaluatorAdapter) Evaluate(rtCtx any, formula string) (any, error) {
	if a.EvaluateFunc == nil {
		return nil, errors.New("formula evaluator is unavailable")
	}
	return a.EvaluateFunc(rtCtx, formula)
}

func matchControlId(control ControlDefinition, controlID string) bool {
	return strings.EqualFold(control.Name, controlID) || strings.EqualFold(control.ID.String(), controlID)
}

func applyRenderDefaults(properties map[string]interface{}) {
	if _, ok := properties["Visible"]; !ok {
		properties["Visible"] = true
	}
}
