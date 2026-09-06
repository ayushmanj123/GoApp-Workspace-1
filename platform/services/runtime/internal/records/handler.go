package records

import (
	"encoding/json"
	"errors"
	"strconv"

	sharederrors "github.com/goapps-platform/shared/errors"
	"github.com/goapps-platform/shared/auth"
	"github.com/goapps-platform/shared/response"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// Handler exposes entity record REST endpoints.
type Handler struct {
	svc *Service
}

// NewHandler creates a record HTTP handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts record CRUD routes on the given router.
func RegisterRoutes(router fiber.Router, svc *Service) {
	h := NewHandler(svc)
	router.Post("/entities/:entityId/records", h.Create)
	router.Get("/entities/:entityId/records", h.List)
	router.Post("/entities/:entityId/records/import", h.Import)
	router.Get("/entities/:entityId/records/:recordId", h.Get)
	router.Patch("/entities/:entityId/records/:recordId", h.Update)
	router.Delete("/entities/:entityId/records/:recordId", h.Delete)
	router.Post("/relationships/:relationshipId/associate", h.Associate)
	router.Post("/relationships/:relationshipId/disassociate", h.Disassociate)
	router.Get("/relationships/:relationshipId/related/:recordId", h.ListRelated)
}

func (h *Handler) Create(c *fiber.Ctx) error {
	ac, err := requireAuth(c)
	if err != nil {
		return err
	}

	entityID, err := uuid.Parse(c.Params("entityId"))
	if err != nil {
		return badRequest(c, "invalid entity id")
	}

	var req CreateRecordRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "invalid request body")
	}

	record, err := h.svc.Create(c.UserContext(), ac.TenantID, ac.UserID, entityID, req.Data)
	if err != nil {
		return mapServiceError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(response.OK(toRecordResponse(record), requestID(c)))
}

func (h *Handler) List(c *fiber.Ctx) error {
	ac, err := requireAuth(c)
	if err != nil {
		return err
	}

	entityID, err := uuid.Parse(c.Params("entityId"))
	if err != nil {
		return badRequest(c, "invalid entity id")
	}

	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	opts := ListOptions{
		Limit:          limit,
		Offset:         offset,
		OrderBy:        c.Query("orderBy"),
		OrderDirection: c.Query("orderDirection"),
	}

	items, total, err := h.svc.List(c.UserContext(), ac.TenantID, entityID, opts)
	if err != nil {
		return mapServiceError(c, err)
	}

	resp := ListRecordsResponse{
		Items:      make([]RecordResponse, 0, len(items)),
		TotalCount: total,
	}
	for i := range items {
		resp.Items = append(resp.Items, toRecordResponse(&items[i]))
	}
	return c.JSON(response.OKPaged(resp, requestID(c), response.Pagination{
		Limit:  limit,
		Offset: offset,
		Total:  total,
	}))
}

func (h *Handler) Get(c *fiber.Ctx) error {
	ac, err := requireAuth(c)
	if err != nil {
		return err
	}

	entityID, err := uuid.Parse(c.Params("entityId"))
	if err != nil {
		return badRequest(c, "invalid entity id")
	}
	recordID, err := uuid.Parse(c.Params("recordId"))
	if err != nil {
		return badRequest(c, "invalid record id")
	}

	record, err := h.svc.Get(c.UserContext(), ac.TenantID, entityID, recordID)
	if err != nil {
		return mapServiceError(c, err)
	}
	return c.JSON(response.OK(toRecordResponse(record), requestID(c)))
}

func (h *Handler) Update(c *fiber.Ctx) error {
	ac, err := requireAuth(c)
	if err != nil {
		return err
	}

	entityID, err := uuid.Parse(c.Params("entityId"))
	if err != nil {
		return badRequest(c, "invalid entity id")
	}
	recordID, err := uuid.Parse(c.Params("recordId"))
	if err != nil {
		return badRequest(c, "invalid record id")
	}

	var req UpdateRecordRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "invalid request body")
	}
	if req.Version <= 0 {
		return badRequest(c, "version is required")
	}

	record, err := h.svc.Update(c.UserContext(), ac.TenantID, ac.UserID, entityID, recordID, req.Data, req.Version)
	if err != nil {
		return mapServiceError(c, err)
	}
	return c.JSON(response.OK(toRecordResponse(record), requestID(c)))
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	ac, err := requireAuth(c)
	if err != nil {
		return err
	}

	entityID, err := uuid.Parse(c.Params("entityId"))
	if err != nil {
		return badRequest(c, "invalid entity id")
	}
	recordID, err := uuid.Parse(c.Params("recordId"))
	if err != nil {
		return badRequest(c, "invalid record id")
	}

	if err := h.svc.Delete(c.UserContext(), ac.TenantID, ac.UserID, entityID, recordID); err != nil {
		return mapServiceError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) Import(c *fiber.Ctx) error {
	ac, err := requireAuth(c)
	if err != nil {
		return err
	}
	entityID, err := uuid.Parse(c.Params("entityId"))
	if err != nil {
		return badRequest(c, "invalid entity id")
	}
	file, err := c.FormFile("file")
	if err != nil {
		return badRequest(c, "file is required")
	}
	f, err := file.Open()
	if err != nil {
		return badRequest(c, "unable to open file")
	}
	defer f.Close()

	mapping := map[string]string{}
	if raw := c.FormValue("mapping"); raw != "" {
		if err := json.Unmarshal([]byte(raw), &mapping); err != nil {
			return badRequest(c, "invalid mapping JSON")
		}
	}
	dryRun := c.FormValue("dryRun") == "true" || c.FormValue("dry_run") == "true"

	result, err := h.svc.ImportCSV(c.UserContext(), ac.TenantID, ac.UserID, entityID, f, mapping, dryRun)
	if err != nil {
		return mapServiceError(c, err)
	}
	return c.JSON(response.OK(result, requestID(c)))
}

type associateRequest struct {
	LeftRecordID  string `json:"leftRecordId"`
	RightRecordID string `json:"rightRecordId"`
}

func (h *Handler) Associate(c *fiber.Ctx) error {
	ac, err := requireAuth(c)
	if err != nil {
		return err
	}
	relationshipID, err := uuid.Parse(c.Params("relationshipId"))
	if err != nil {
		return badRequest(c, "invalid relationship id")
	}
	var req associateRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "invalid request body")
	}
	leftID, err := uuid.Parse(req.LeftRecordID)
	if err != nil {
		return badRequest(c, "invalid leftRecordId")
	}
	rightID, err := uuid.Parse(req.RightRecordID)
	if err != nil {
		return badRequest(c, "invalid rightRecordId")
	}
	if err := h.svc.Associate(c.UserContext(), ac.TenantID, ac.UserID, relationshipID, leftID, rightID); err != nil {
		return mapServiceError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) Disassociate(c *fiber.Ctx) error {
	ac, err := requireAuth(c)
	if err != nil {
		return err
	}
	relationshipID, err := uuid.Parse(c.Params("relationshipId"))
	if err != nil {
		return badRequest(c, "invalid relationship id")
	}
	var req associateRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "invalid request body")
	}
	leftID, err := uuid.Parse(req.LeftRecordID)
	if err != nil {
		return badRequest(c, "invalid leftRecordId")
	}
	rightID, err := uuid.Parse(req.RightRecordID)
	if err != nil {
		return badRequest(c, "invalid rightRecordId")
	}
	if err := h.svc.Disassociate(c.UserContext(), ac.TenantID, ac.UserID, relationshipID, leftID, rightID); err != nil {
		return mapServiceError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) ListRelated(c *fiber.Ctx) error {
	ac, err := requireAuth(c)
	if err != nil {
		return err
	}
	relationshipID, err := uuid.Parse(c.Params("relationshipId"))
	if err != nil {
		return badRequest(c, "invalid relationship id")
	}
	recordID, err := uuid.Parse(c.Params("recordId"))
	if err != nil {
		return badRequest(c, "invalid record id")
	}
	fromLeft := c.Query("side", "left") != "right"
	ids, err := h.svc.ListRelated(c.UserContext(), ac.TenantID, relationshipID, recordID, fromLeft)
	if err != nil {
		return mapServiceError(c, err)
	}
	return c.JSON(response.OK(map[string]interface{}{"recordIds": ids}, requestID(c)))
}

func requireAuth(c *fiber.Ctx) (*auth.AuthContext, error) {
	ac, ok := auth.GetFiberAuthContext(c)
	if !ok || ac == nil || !ac.IsAuthenticated {
		return nil, c.Status(fiber.StatusUnauthorized).JSON(response.Fail("UNAUTHORIZED", "authentication required", requestID(c)))
	}
	return ac, nil
}

func mapServiceError(c *fiber.Ctx, err error) error {
	var validationErr *ValidationError
	switch {
	case errors.Is(err, ErrNotFound), errors.Is(err, ErrEntityNotFound):
		return sharederrors.NotFound(err.Error())
	case errors.Is(err, ErrVersionConflict):
		return sharederrors.New("VERSION_CONFLICT", err.Error(), 409)
	case errors.As(err, &validationErr):
		details := map[string]interface{}{}
		if validationErr.Field != "" {
			details[validationErr.Field] = validationErr.Message
		}
		return sharederrors.Validation(validationErr.Error(), details)
	case errors.Is(err, ErrValidation):
		return sharederrors.Validation(err.Error(), nil)
	default:
		return sharederrors.Wrap(err, "INTERNAL_ERROR", "internal server error", 500)
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
