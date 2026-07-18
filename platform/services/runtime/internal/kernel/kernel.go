package kernel

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/goapps-platform/runtime-service/internal/formula"
	runtimemetrics "github.com/goapps-platform/runtime-service/internal/metrics"
	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/goapps-platform/runtime-service/internal/state"
	"github.com/google/uuid"
)

var ErrSessionLimit = errors.New("maximum active sessions reached")

// RuntimeKernel orchestrates runtime services through a single execution pipeline.
type RuntimeKernel struct {
	registry *Registry
	sessions *SessionManager
}

// NewRuntimeKernel creates a kernel with the provided service registry.
func NewRuntimeKernel(registry *Registry) *RuntimeKernel {
	ttl := 30 * time.Minute
	if registry != nil && registry.SessionTTL > 0 {
		ttl = registry.SessionTTL
	}
	return &RuntimeKernel{
		registry: registry,
		sessions: NewSessionManager(ttl),
	}
}

// StartCleanup launches background expiration for inactive sessions.
func (k *RuntimeKernel) StartCleanup(ctx context.Context) {
	if k == nil || k.sessions == nil {
		return
	}
	k.sessions.StartCleanup(ctx, k.registry, func(session *RuntimeSession) {
		if session != nil {
			k.clearSessionResources(session.ID, session.AppID, session.TenantID)
		}
		k.updateSessionMetrics()
	})
}

// StartSession creates runtime state, caches metadata, registers dependencies, and runs App.OnStart.
func (k *RuntimeKernel) StartSession(ctx context.Context, tenantID, userID uuid.UUID, req StartSessionRequest) (*StartSessionResponse, error) {
	if k == nil || k.registry == nil {
		return nil, ErrMetadataMissing
	}
	if req.AppID == uuid.Nil {
		return nil, state.ErrInvalidRequest
	}
	channel := strings.TrimSpace(req.Channel)
	if channel == "" {
		channel = "draft"
	}

	if k.registry.MaxSessions > 0 && k.sessions.Count() >= k.registry.MaxSessions {
		return nil, ErrSessionLimit
	}

	pkg, err := k.loadMetadata(ctx, tenantID, req.AppID, channel)
	if err != nil {
		return nil, err
	}

	sessionID := k.registry.State.CreateSession(req.AppID)
	manager, err := k.registry.State.GetManager(req.AppID, sessionID)
	if err != nil {
		return nil, err
	}

	session := &RuntimeSession{
		ID:       sessionID,
		AppID:    req.AppID,
		TenantID: tenantID,
		UserID:   userID,
		Channel:  channel,
		Package:  pkg,
		State:    manager,
	}
	session.Dependencies = buildDependencies(pkg)
	if k.registry.Properties != nil {
		k.registerPropertyDependencies(session)
	}
	if k.registry.Renderer != nil {
		k.registerRendererDependencies(session)
	} else {
		k.registry.Reactive.RegisterDependencies(sessionID, session.Dependencies)
	}

	refresh := reactive.RefreshResponse{}
	if formulaText := appOnStart(pkg); formulaText != "" {
		result, eventRefresh, err := k.executeFormula(ctx, session, req.Screen, formulaText)
		if err != nil {
			k.releaseSession(session)
			return nil, err
		}
		_ = result
		refresh.Refresh = reactive.MergeRefresh(refresh, reactive.RefreshResponse{Refresh: eventRefresh})
	}

	if screen := strings.TrimSpace(req.Screen); screen != "" {
		screenRefresh, err := k.runScreenVisible(ctx, session, screen)
		if err != nil {
			k.releaseSession(session)
			return nil, err
		}
		refresh.Refresh = reactive.MergeRefresh(refresh, screenRefresh)
		session.CurrentScreen = screen
		if err := k.loadScreenGalleries(ctx, session, screen); err != nil {
			k.releaseSession(session)
			return nil, err
		}
		if err := k.loadScreenForms(ctx, session, screen); err != nil {
			k.releaseSession(session)
			return nil, err
		}
	}

	k.sessions.Put(session)
	k.updateSessionMetrics()
	return &StartSessionResponse{
		SessionID: sessionID,
		AppID:     req.AppID,
		Refresh:   refresh.Refresh,
	}, nil
}

// HandleControlEvent executes a control or screen lifecycle event and returns refresh instructions.
func (k *RuntimeKernel) HandleControlEvent(ctx context.Context, sessionID uuid.UUID, req ControlEventRequest) (*ControlEventResponse, error) {
	session, ok := k.sessions.Get(sessionID)
	if !ok {
		return nil, ErrSessionNotFound
	}
	if req.AppID != uuid.Nil && req.AppID != session.AppID {
		return nil, ErrSessionNotFound
	}
	session.Touch()
	k.sessions.Put(session)

	event := strings.TrimSpace(req.Event)
	screen := strings.TrimSpace(req.Screen)
	if screen == "" {
		screen = session.CurrentScreen
	}

	switch event {
	case "OnVisible":
		if screen == "" {
			return nil, ErrFormulaNotFound
		}
		refresh, err := k.runScreenVisible(ctx, session, screen)
		if err != nil {
			return nil, err
		}
		if session.State != nil && strings.TrimSpace(session.CurrentScreen) != "" && !strings.EqualFold(session.CurrentScreen, screen) {
			session.State.SetVariable("varPreviousScreen", session.CurrentScreen)
		}
		session.CurrentScreen = screen
		if err := k.loadScreenGalleries(ctx, session, screen); err != nil {
			return nil, err
		}
		if err := k.loadScreenForms(ctx, session, screen); err != nil {
			return nil, err
		}
		return k.controlEventResponse(session, &ControlEventResponse{Refresh: refresh.Refresh}), nil
	case "OnHidden":
		return k.controlEventResponse(session, &ControlEventResponse{}), nil
	}

	formulaText, err := k.lookupControlFormula(session, req.ControlID, event)
	if err != nil {
		return nil, err
	}

	result, refresh, err := k.executeFormula(ctx, session, screen, formulaText)
	if err != nil {
		return nil, err
	}
	return k.controlEventResponse(session, &ControlEventResponse{
		Result:  result,
		Refresh: refresh,
	}), nil
}

func (k *RuntimeKernel) controlEventResponse(session *RuntimeSession, resp *ControlEventResponse) *ControlEventResponse {
	if resp == nil {
		resp = &ControlEventResponse{}
	}
	if session != nil {
		resp.CurrentScreen = session.CurrentScreen
	}
	return resp
}

// Session returns a cached runtime session when present.
func (k *RuntimeKernel) Session(sessionID uuid.UUID) (*RuntimeSession, bool) {
	return k.sessions.Get(sessionID)
}

// ExpireSession removes a session and releases associated resources.
func (k *RuntimeKernel) ExpireSession(sessionID uuid.UUID) {
	session, ok := k.sessions.Get(sessionID)
	if !ok {
		return
	}
	k.releaseSession(session)
}

func (k *RuntimeKernel) loadMetadata(ctx context.Context, tenantID, appID uuid.UUID, channel string) (*Package, error) {
	if k.registry.Metadata == nil {
		return nil, ErrMetadataMissing
	}
	return k.registry.Metadata.Load(ctx, tenantID, appID, channel)
}

func (k *RuntimeKernel) buildFormulaContext(ctx context.Context, session *RuntimeSession, screen string) *formula.RuntimeFormulaContext {
	if screen == "" {
		screen = session.CurrentScreen
	}
	nav := &sessionNavigation{
		NavigationService: &reactive.NavigationService{
			Publisher: k.registry.Reactive.Notifier,
			SessionID: session.ID,
			AppID:     session.AppID,
		},
		session: session,
		kernel:  k,
		ctx:     ctx,
	}
	rtCtx := &formula.RuntimeFormulaContext{
		Ctx:         ctx,
		State:       session.State,
		DataSources: k.registry.DataSources,
		Resolver:    k.registry.Resolver,
		Navigation:  nav,
		Events:      k.propertyPublisher(),
		Gallery:     k.registry.Gallery.Reader(session.ID),
		Forms:       k.registry.Form.Reader(session.ID),
		FormActions: &kernelFormActions{ctx: ctx, kernel: k, session: session},
		User: formula.UserContext{
			TenantID: session.TenantID,
			UserID:   session.UserID,
		},
		App: formula.AppContext{AppID: session.AppID},
		Session: formula.SessionContext{
			SessionID: session.ID,
			Screen:    screen,
		},
	}
	nav.OnNavigate = func(resp reactive.RefreshResponse) {
		rtCtx.RecordRefresh(resp)
	}
	return rtCtx
}

type sessionNavigation struct {
	*reactive.NavigationService
	session *RuntimeSession
	kernel  *RuntimeKernel
	ctx     context.Context
}

func (n *sessionNavigation) Navigate(screenName string) error {
	if n == nil || n.NavigationService == nil {
		return nil
	}
	screenName = strings.TrimSpace(screenName)
	if n.session != nil && n.session.State != nil && strings.TrimSpace(n.session.CurrentScreen) != "" {
		n.session.State.SetVariable("varPreviousScreen", n.session.CurrentScreen)
	}
	if err := n.NavigationService.Navigate(screenName); err != nil {
		return err
	}
	if n.session != nil {
		n.session.CurrentScreen = screenName
	}
	if n.kernel != nil && n.session != nil {
		_ = n.kernel.loadScreenGalleries(n.ctx, n.session, screenName)
		_ = n.kernel.loadScreenForms(n.ctx, n.session, screenName)
	}
	return nil
}

func (k *RuntimeKernel) executeFormula(ctx context.Context, session *RuntimeSession, screen, formulaText string) (any, []reactive.RefreshInstruction, error) {
	return k.executeFormulaWithOverlay(ctx, session, screen, formulaText, nil)
}

func (k *RuntimeKernel) executeFormulaWithOverlay(ctx context.Context, session *RuntimeSession, screen, formulaText string, overlay map[string]interface{}) (any, []reactive.RefreshInstruction, error) {
	rtCtx := k.buildFormulaContext(ctx, session, screen)
	if len(overlay) > 0 {
		rtCtx.Overlay = overlay
	}
	result, err := k.registry.Formula.Evaluate(rtCtx, formulaText)
	if err != nil {
		return nil, nil, err
	}
	if k.registry.Reactive != nil {
		rtCtx.RecordRefresh(k.registry.Reactive.Notifier.FormulaExecuted(session.ID, session.AppID, formulaText))
	}
	k.invalidatePropertyCache(session.ID, rtCtx.Refresh)
	if err := k.syncGalleriesAfterRefresh(ctx, session, rtCtx.Refresh); err != nil {
		return nil, nil, err
	}
	return result, rtCtx.Refresh, nil
}

// EvaluateExpression evaluates a formula in an active session using the full kernel context.
func (k *RuntimeKernel) EvaluateExpression(ctx context.Context, sessionID uuid.UUID, screen, formulaText string, overlay map[string]interface{}) (any, []reactive.RefreshInstruction, error) {
	session, ok := k.sessions.Get(sessionID)
	if !ok {
		return nil, nil, ErrSessionNotFound
	}
	session.Touch()
	return k.executeFormulaWithOverlay(ctx, session, screen, formulaText, overlay)
}

func (k *RuntimeKernel) lookupControlFormula(session *RuntimeSession, controlID, event string) (string, error) {
	if session == nil || session.Package == nil {
		return "", ErrControlNotFound
	}
	control, ok := session.Package.Controls[strings.ToLower(strings.TrimSpace(controlID))]
	if !ok {
		return "", ErrControlNotFound
	}
	propertyName := eventPropertyName(event)
	for _, item := range control.Formulas {
		if strings.EqualFold(item.PropertyName, propertyName) {
			return item.FormulaText, nil
		}
	}
	return "", ErrFormulaNotFound
}

func (k *RuntimeKernel) releaseSession(session *RuntimeSession) {
	if session == nil {
		return
	}
	k.clearSessionResources(session.ID, session.AppID, session.TenantID)
	k.sessions.Delete(session.ID)
	k.updateSessionMetrics()
}

func (k *RuntimeKernel) updateSessionMetrics() {
	if k == nil || k.sessions == nil {
		return
	}
	runtimemetrics.SetActiveSessions(k.sessions.Count())
}

func (k *RuntimeKernel) clearSessionResources(sessionID, appID, tenantID uuid.UUID) {
	if k.registry == nil {
		return
	}
	if k.registry.State != nil && appID != uuid.Nil {
		k.registry.State.DeleteSession(appID, sessionID)
	}
	if k.registry.Reactive != nil {
		k.registry.Reactive.ClearSession(sessionID)
	}
	if k.registry.Gallery != nil {
		k.registry.Gallery.ClearSession(sessionID)
	}
	if k.registry.Form != nil {
		k.registry.Form.ClearSession(sessionID)
	}
	if k.registry.Properties != nil {
		k.registry.Properties.ClearSession(sessionID)
	}
	if k.registry.Renderer != nil {
		k.registry.Renderer.ClearSession(sessionID)
	}
	_ = tenantID
}

func appOnStart(pkg *Package) string {
	if pkg == nil || pkg.OnStart == nil {
		return ""
	}
	return strings.TrimSpace(*pkg.OnStart)
}
