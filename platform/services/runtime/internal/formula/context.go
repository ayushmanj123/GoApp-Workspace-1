package formula

import (
	"context"

	"github.com/goapps-platform/runtime-service/internal/databinding"
	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/goapps-platform/runtime-service/internal/state"
	"github.com/google/uuid"
)

// UserContext carries authenticated identity for formula execution.
type UserContext struct {
	TenantID uuid.UUID
	UserID   uuid.UUID
	Email    string
}

// AppContext identifies the running application.
type AppContext struct {
	AppID uuid.UUID
}

// SessionContext identifies the runtime session and active screen.
type SessionContext struct {
	SessionID uuid.UUID
	Screen    string
}

// NavigationService navigates between runtime screens.
// The kernel session path (POST /api/runtime/session/:sessionId/evaluate and
// control events) wires a session-aware implementation that updates the
// session's current screen and reloads screen galleries/forms (see
// kernel.sessionNavigation). The standalone formula endpoint
// (POST /api/runtime/formula/evaluate) only publishes a NavigationRequested
// event via reactive.NavigationService when a reactive engine is configured
// (Phase 7.15); it has no session/screen model of its own, so callers that
// need real navigation should use the session-scoped endpoints.
type NavigationService interface {
	Navigate(screenName string) error
}

// BindingResolver resolves datasource names for data functions.
type BindingResolver interface {
	Resolve(ctx context.Context, tenantID, appID uuid.UUID, dataSourceName string, overrides databinding.QueryOverrides) (*databinding.ResolvedBinding, databinding.QueryInput, error)
}

// GalleryReader exposes gallery items and selection to formulas.
type GalleryReader interface {
	ResolveReference(reference string) (any, bool)
	GetItems(galleryName string) []any
	GetSelected(galleryName string) (any, bool)
}

// FormReader exposes form state to formulas.
type FormReader interface {
	ResolveReference(reference string) (any, bool)
}

// FormActions executes imperative form operations from formulas.
type FormActions interface {
	SubmitForm(formName string) (dataSource string, err error)
	ResetForm(formName string) error
	SetFormMode(formName, mode string) error
}

// RuntimeFormulaContext is the sole execution context for runtime formulas.
type RuntimeFormulaContext struct {
	Ctx          context.Context
	State        state.FormulaStateManager
	DataSources  *databinding.DataSourceRegistry
	Resolver     BindingResolver
	Navigation   NavigationService
	Events       reactive.Publisher
	Gallery      GalleryReader
	Forms        FormReader
	FormActions  FormActions
	User         UserContext
	App          AppContext
	Session      SessionContext
	Refresh      []reactive.RefreshInstruction
	// Overlay carries request-scoped values (e.g. ThisItem, Parent) that take
	// precedence over session state for the duration of a single evaluation.
	Overlay map[string]interface{}
}

// RecordRefresh merges refresh instructions produced during formula execution.
func (rtCtx *RuntimeFormulaContext) RecordRefresh(resp reactive.RefreshResponse) {
	if rtCtx == nil {
		return
	}
	rtCtx.Refresh = reactive.MergeRefresh(
		reactive.RefreshResponse{Refresh: rtCtx.Refresh},
		resp,
	)
}

// EvaluateRequest is the body for POST /api/runtime/formula/evaluate.
type EvaluateRequest struct {
	AppID     uuid.UUID              `json:"appId"`
	SessionID uuid.UUID              `json:"sessionId"`
	Screen    string                 `json:"screen,omitempty"`
	Formula   string                 `json:"formula"`
	Context   map[string]interface{} `json:"context,omitempty"`
}

// SessionEvaluateRequest is the body for POST /api/runtime/session/:sessionId/evaluate.
type SessionEvaluateRequest struct {
	AppID   uuid.UUID              `json:"appId"`
	Screen  string                 `json:"screen,omitempty"`
	Formula string                 `json:"formula"`
	Context map[string]interface{} `json:"context,omitempty"`
}

// EvaluateResponse is returned after formula execution.
type EvaluateResponse struct {
	Result        any                           `json:"result"`
	Refresh       []reactive.RefreshInstruction `json:"refresh,omitempty"`
	CurrentScreen string                        `json:"currentScreen,omitempty"`
}

// FormulaError is a structured runtime formula error.
type FormulaError struct {
	Code     string `json:"code"`
	Message  string `json:"message"`
	Position *int   `json:"position,omitempty"`
}

func (e *FormulaError) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

func newFormulaError(code, message string, position *int) *FormulaError {
	return &FormulaError{Code: code, Message: message, Position: position}
}

// NoopNavigationService is the fallback navigation implementation used only
// when neither a reactive engine nor an explicit NavigationService is
// injected into Dependencies (e.g. in isolated unit tests). Production
// wiring in server.go always sets Reactive, so runtime.Service.Evaluate
// upgrades to reactive.NavigationService before this stub is ever reached.
type NoopNavigationService struct{}

func (NoopNavigationService) Navigate(screenName string) error {
	return newFormulaError("NAVIGATION_NOT_IMPLEMENTED", "navigation is not implemented: "+screenName, nil)
}
