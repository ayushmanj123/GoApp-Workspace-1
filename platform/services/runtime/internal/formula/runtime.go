package formula

import (
	"errors"
	"strings"

	"github.com/goapps-platform/runtime-service/internal/databinding"
	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/goapps-platform/runtime-service/internal/records"
	"github.com/goapps-platform/runtime-service/internal/state"
	"github.com/goapps-platform/shared/auth"
	"github.com/goapps-platform/shared/response"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// Dependencies wires runtime formula execution to platform services.
type Dependencies struct {
	StateStore  *state.MemoryStore
	Resolver    BindingResolver
	DataSources *databinding.DataSourceRegistry
	Navigation  NavigationService
	Reactive    *reactive.Engine
}

// Service executes runtime formulas through HTTP.
type Service struct {
	deps       Dependencies
	evaluator  *Evaluator
}

func NewService(deps Dependencies) *Service {
	navigation := deps.Navigation
	if navigation == nil {
		navigation = NoopNavigationService{}
	}
	deps.Navigation = navigation
	return &Service{
		deps:      deps,
		evaluator: NewEvaluator(),
	}
}

// RegisterRoutes mounts formula evaluation endpoints.
func RegisterRoutes(router fiber.Router, svc *Service) {
	router.Post("/runtime/formula/evaluate", svc.Evaluate)
}

func (s *Service) Evaluate(c *fiber.Ctx) error {
	ac, err := requireAuth(c)
	if err != nil {
		return err
	}

	var req EvaluateRequest
	if err := c.BodyParser(&req); err != nil {
		return formulaBadRequest(c, "invalid request body")
	}
	if req.AppID == uuid.Nil || req.SessionID == uuid.Nil {
		return formulaBadRequest(c, "appId and sessionId are required")
	}
	if strings.TrimSpace(req.Formula) == "" {
		return formulaBadRequest(c, "formula is required")
	}

	manager, err := s.deps.StateStore.GetManager(req.AppID, req.SessionID)
	if err != nil {
		return mapFormulaServiceError(c, err)
	}

	navigation := s.deps.Navigation
	if s.deps.Reactive != nil {
		navigation = &reactive.NavigationService{
			Publisher: s.deps.Reactive.Notifier,
			SessionID: req.SessionID,
			AppID:     req.AppID,
		}
	} else if navigation == nil {
		navigation = NoopNavigationService{}
	}

	rtCtx := &RuntimeFormulaContext{
		Ctx:         c.UserContext(),
		State:       manager,
		DataSources: s.deps.DataSources,
		Resolver:    s.deps.Resolver,
		Navigation:  navigation,
		Events:      publisherForDeps(s.deps),
		User: UserContext{
			TenantID: ac.TenantID,
			UserID:   ac.UserID,
			Email:    ac.Email,
		},
		App: AppContext{AppID: req.AppID},
		Session: SessionContext{
			SessionID: req.SessionID,
			Screen:    req.Screen,
		},
	}
	if nav, ok := navigation.(*reactive.NavigationService); ok {
		nav.OnNavigate = rtCtx.RecordRefresh
	}

	result, err := s.evaluator.Evaluate(rtCtx, req.Formula)
	if err != nil {
		return mapFormulaError(c, err)
	}
	if rtCtx.Events != nil {
		rtCtx.RecordRefresh(rtCtx.Events.FormulaExecuted(req.SessionID, req.AppID, req.Formula))
	}

	return c.JSON(response.OK(EvaluateResponse{Result: result, Refresh: rtCtx.Refresh}, requestID(c)))
}

func publisherForDeps(deps Dependencies) reactive.Publisher {
	if deps.Reactive == nil {
		return nil
	}
	return deps.Reactive.Notifier
}

func requireAuth(c *fiber.Ctx) (*auth.AuthContext, error) {
	ac, ok := auth.GetFiberAuthContext(c)
	if !ok || ac == nil || !ac.IsAuthenticated {
		return nil, c.Status(fiber.StatusUnauthorized).JSON(response.Fail("UNAUTHORIZED", "authentication required", requestID(c)))
	}
	return ac, nil
}

func mapFormulaError(c *fiber.Ctx, err error) error {
	var formulaErr *FormulaError
	if errors.As(err, &formulaErr) {
		status := fiber.StatusBadRequest
		if formulaErr.Code == "RUNTIME_ERROR" || formulaErr.Code == "DATASOURCE_NOT_FOUND" {
			status = fiber.StatusUnprocessableEntity
		}
		return c.Status(status).JSON(response.Envelope{
			Success: false,
			Error: &response.APIError{
				Code:    formulaErr.Code,
				Message: formulaErr.Message,
			},
			Meta: responseMeta(c),
			Data: formulaErr,
		})
	}
	return c.Status(fiber.StatusInternalServerError).JSON(response.Fail("INTERNAL_ERROR", err.Error(), requestID(c)))
}

func mapFormulaServiceError(c *fiber.Ctx, err error) error {
	if errors.Is(err, state.ErrSessionNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(response.Fail("NOT_FOUND", err.Error(), requestID(c)))
	}
	return c.Status(fiber.StatusInternalServerError).JSON(response.Fail("INTERNAL_ERROR", err.Error(), requestID(c)))
}

func formulaBadRequest(c *fiber.Ctx, message string) error {
	return c.Status(fiber.StatusBadRequest).JSON(response.Fail("BAD_REQUEST", message, requestID(c)))
}

func requestID(c *fiber.Ctx) string {
	if id, ok := c.Locals("requestID").(string); ok {
		return id
	}
	return ""
}

func responseMeta(c *fiber.Ctx) *response.Meta {
	id := requestID(c)
	if id == "" {
		return nil
	}
	return &response.Meta{RequestID: id}
}

func mapDataError(err error) error {
	return mapRuntimeDataError(err)
}

func mapRuntimeDataError(err error) error {
	switch {
	case errors.Is(err, databinding.ErrDataSourceNotFound), errors.Is(err, records.ErrEntityNotFound):
		return newFormulaError("DATASOURCE_NOT_FOUND", err.Error(), nil)
	case errors.Is(err, records.ErrVersionConflict):
		return newFormulaError("RUNTIME_ERROR", err.Error(), nil)
	case errors.Is(err, records.ErrValidation):
		return newFormulaError("INVALID_FORMULA", err.Error(), nil)
	default:
		return newFormulaError("RUNTIME_ERROR", err.Error(), nil)
	}
}

func parseUUID(value string) (uuid.UUID, error) {
	return uuid.Parse(strings.TrimSpace(value))
}
