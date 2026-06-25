package databinding

import (
	"context"
	"errors"
	"strconv"

	"github.com/goapps-platform/shared/auth"
	"github.com/goapps-platform/shared/response"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// Service executes datasource queries for runtime controls.
type Service struct {
	resolver *Resolver
	sources  *DataSourceRegistry
}

func NewService(resolver *Resolver, sources *DataSourceRegistry) *Service {
	return &Service{
		resolver: resolver,
		sources:  sources,
	}
}

// QueryDataSource resolves metadata and executes a datasource query.
func (s *Service) QueryDataSource(ctx context.Context, tenantID, userID, appID uuid.UUID, dataSourceName string, overrides QueryOverrides) (*QueryResult, error) {
	binding, query, err := s.resolver.Resolve(ctx, tenantID, appID, dataSourceName, overrides)
	if err != nil {
		return nil, err
	}
	query.TenantID = tenantID
	query.UserID = userID

	key := cacheKey(tenantID, appID, dataSourceName, query)
	if cache := requestCacheFromContext(ctx); cache != nil {
		if cached, ok := cache.Get(key); ok {
			return cached, nil
		}
	}

	source, err := s.sources.ForKind(binding.Kind)
	if err != nil {
		return nil, err
	}

	result, err := source.Query(ctx, query)
	if err != nil {
		return nil, err
	}

	if cache := requestCacheFromContext(ctx); cache != nil {
		cache.Set(key, result)
	}
	return result, nil
}

// Handler exposes runtime datasource HTTP endpoints.
type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts datasource routes on the given router.
func RegisterRoutes(router fiber.Router, svc *Service) {
	h := NewHandler(svc)
	router.Get("/runtime/apps/:appId/datasources/:name", h.QueryDataSource)
}

func (h *Handler) QueryDataSource(c *fiber.Ctx) error {
	ac, err := requireAuth(c)
	if err != nil {
		return err
	}

	appID, err := uuid.Parse(c.Params("appId"))
	if err != nil {
		return badRequest(c, "invalid application id")
	}
	name := c.Params("name")
	if name == "" {
		return badRequest(c, "datasource name is required")
	}

	overrides := QueryOverrides{
		Filter:         c.Query("filter"),
		Sort:           c.Query("sort"),
		OrderDirection: c.Query("order"),
	}
	if limit, err := strconv.Atoi(c.Query("limit", "0")); err == nil {
		overrides.Limit = limit
	}
	if offset, err := strconv.Atoi(c.Query("offset", "0")); err == nil {
		overrides.Offset = offset
	}

	ctx := WithRequestCache(c.UserContext())
	result, err := h.svc.QueryDataSource(ctx, ac.TenantID, ac.UserID, appID, name, overrides)
	if err != nil {
		return mapServiceError(c, err)
	}
	return c.JSON(response.OK(result, requestID(c)))
}

// RequestCacheMiddleware attaches a per-request datasource cache to each HTTP request.
func RequestCacheMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		c.SetUserContext(WithRequestCache(c.UserContext()))
		return c.Next()
	}
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
	case errors.Is(err, ErrDataSourceNotFound):
		return c.Status(fiber.StatusNotFound).JSON(response.Fail("NOT_FOUND", err.Error(), requestID(c)))
	case errors.Is(err, ErrInvalidFilter), errors.Is(err, ErrInvalidQuery):
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
