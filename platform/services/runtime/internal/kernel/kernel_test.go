package kernel

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/goapps-platform/runtime-service/internal/databinding"
	"github.com/goapps-platform/runtime-service/internal/form"
	"github.com/goapps-platform/runtime-service/internal/gallery"
	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/goapps-platform/runtime-service/internal/state"
	"github.com/google/uuid"
)

type fakeMetadataLoader struct {
	mu    sync.Mutex
	loads int
	pkg   *Package
}

func (f *fakeMetadataLoader) Load(ctx context.Context, tenantID, appID uuid.UUID, channel string) (*Package, error) {
	_ = ctx
	_ = tenantID
	_ = channel
	f.mu.Lock()
	defer f.mu.Unlock()
	f.loads++
	if f.pkg != nil {
		return f.pkg, nil
	}
	return testPackage(appID), nil
}

func (f *fakeMetadataLoader) loadCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.loads
}

func testPackage(appID uuid.UUID) *Package {
	onStart := "Set(varStarted, true)"
	onVisible := "Set(varVisible, true)"
	btnID := uuid.New()
	labelID := uuid.New()
	screenID := uuid.New()
	return &Package{
		AppID:   appID,
		OnStart: &onStart,
		Screens: []RuntimeScreen{{
			ID:        screenID,
			Name:      "Home",
			OnVisible: &onVisible,
		}},
		Controls: map[string]RuntimeControl{
			"btnsave": {
				ID:     btnID,
				Name:   "btnSave",
				Screen: "Home",
				Formulas: []RuntimeFormula{{
					PropertyName: "onSelect",
					FormulaText:  "Set(varSaved, true)",
					FormulaType:  "action",
				}},
			},
			"lblstatus": {
				ID:     labelID,
				Name:   "lblStatus",
				Screen: "Home",
				Formulas: []RuntimeFormula{{
					PropertyName: "text",
					FormulaText:  "varSaved",
					FormulaType:  "expression",
				}},
			},
		},
		ScreensByName: map[string]RuntimeScreen{
			"home": {ID: screenID, Name: "Home", OnVisible: &onVisible},
		},
	}
}

func newTestKernel(loader *fakeMetadataLoader) *RuntimeKernel {
	stateStore := state.NewMemoryStore()
	reactiveEngine := reactive.NewEngine()
	registry := NewRegistry(stateStore, reactiveEngine, nil, databinding.NewDataSourceRegistry(nil), nil, gallery.NewService(gallery.NewSessionStore(), nil, nil), form.NewService(form.NewSessionStore(), nil, nil, nil, nil, nil), nil, nil, loader)
	registry.SessionTTL = time.Millisecond * 100
	return NewRuntimeKernel(registry)
}

func TestStartSessionCreatesStateAndRunsOnStart(t *testing.T) {
	appID := uuid.New()
	tenantID := uuid.New()
	userID := uuid.New()
	loader := &fakeMetadataLoader{}
	kernel := newTestKernel(loader)

	resp, err := kernel.StartSession(context.Background(), tenantID, userID, StartSessionRequest{
		AppID:  appID,
		Screen: "Home",
	})
	if err != nil {
		t.Fatalf("StartSession: %v", err)
	}
	if resp.SessionID == uuid.Nil {
		t.Fatal("expected session id")
	}

	session, ok := kernel.Session(resp.SessionID)
	if !ok || session.Package == nil {
		t.Fatal("expected cached metadata on session")
	}
	if loader.loadCount() != 1 {
		t.Fatalf("expected metadata loaded once, got %d", loader.loadCount())
	}

	value, ok := session.State.GetVariable("varStarted")
	if !ok || value != true {
		t.Fatalf("expected varStarted=true, got %#v ok=%v", value, ok)
	}

	visible, ok := session.State.GetVariable("varVisible")
	if !ok || visible != true {
		t.Fatalf("expected varVisible=true, got %#v ok=%v", visible, ok)
	}
}

func TestHandleControlEventOnSelectUpdatesStateAndRefresh(t *testing.T) {
	appID := uuid.New()
	tenantID := uuid.New()
	userID := uuid.New()
	kernel := newTestKernel(&fakeMetadataLoader{})

	start, err := kernel.StartSession(context.Background(), tenantID, userID, StartSessionRequest{
		AppID:  appID,
		Screen: "Home",
	})
	if err != nil {
		t.Fatalf("StartSession: %v", err)
	}

	eventResp, err := kernel.HandleControlEvent(context.Background(), start.SessionID, ControlEventRequest{
		AppID:     appID,
		ControlID: "btnSave",
		Event:     "OnSelect",
		Screen:    "Home",
	})
	if err != nil {
		t.Fatalf("HandleControlEvent: %v", err)
	}

	session, _ := kernel.Session(start.SessionID)
	value, ok := session.State.GetVariable("varSaved")
	if !ok || value != true {
		t.Fatalf("expected varSaved=true, got %#v ok=%v", value, ok)
	}

	found := false
	for _, item := range eventResp.Refresh {
		if item.ControlID == "lblStatus" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected lblStatus refresh, got %#v", eventResp.Refresh)
	}
}

func TestMetadataCachedPerSession(t *testing.T) {
	loader := &fakeMetadataLoader{}
	kernel := newTestKernel(loader)
	appID := uuid.New()
	tenantID := uuid.New()
	userID := uuid.New()

	first, err := kernel.StartSession(context.Background(), tenantID, userID, StartSessionRequest{AppID: appID})
	if err != nil {
		t.Fatalf("first session: %v", err)
	}
	second, err := kernel.StartSession(context.Background(), tenantID, userID, StartSessionRequest{AppID: appID})
	if err != nil {
		t.Fatalf("second session: %v", err)
	}
	if first.SessionID == second.SessionID {
		t.Fatal("expected distinct session ids")
	}
	if loader.loadCount() != 2 {
		t.Fatalf("expected metadata load per session, got %d", loader.loadCount())
	}
}

func TestSessionExpirationReleasesResources(t *testing.T) {
	loader := &fakeMetadataLoader{}
	kernel := newTestKernel(loader)
	kernel.sessions.ttl = time.Millisecond
	appID := uuid.New()
	tenantID := uuid.New()
	userID := uuid.New()

	resp, err := kernel.StartSession(context.Background(), tenantID, userID, StartSessionRequest{AppID: appID})
	if err != nil {
		t.Fatalf("StartSession: %v", err)
	}

	session, ok := kernel.Session(resp.SessionID)
	if !ok {
		t.Fatal("expected active session")
	}
	session.LastActive = time.Now().UTC().Add(-time.Second)

	expired := kernel.sessions.ExpireIdle(time.Now().UTC())
	if len(expired) != 1 {
		t.Fatalf("expected one expired session, got %d", len(expired))
	}
	kernel.clearSessionResources(expired[0].ID, expired[0].AppID, expired[0].TenantID)

	if _, ok := kernel.Session(resp.SessionID); ok {
		t.Fatal("expected session removed")
	}
	if _, err := kernel.registry.State.GetManager(appID, resp.SessionID); err == nil {
		t.Fatal("expected state released")
	}
	if len(kernel.registry.Reactive.Dependencies(resp.SessionID)) != 0 {
		t.Fatal("expected reactive dependencies cleared")
	}
}

// TestEvaluateExpressionNavigateUpdatesCurrentScreen verifies that the
// session-scoped evaluate path (kernel.EvaluateExpression, backing
// POST /api/runtime/session/:sessionId/evaluate) performs real navigation:
// Navigate() must not return NAVIGATION_NOT_IMPLEMENTED, and the session's
// CurrentScreen must reflect the target screen afterwards (Phase 7.15).
func TestEvaluateExpressionNavigateUpdatesCurrentScreen(t *testing.T) {
	appID := uuid.New()
	loader := &fakeMetadataLoader{pkg: navigationTestPackage(appID)}
	kernel := newTestKernel(loader)

	start, err := kernel.StartSession(context.Background(), uuid.New(), uuid.New(), StartSessionRequest{
		AppID:  appID,
		Screen: "Home",
	})
	if err != nil {
		t.Fatalf("StartSession: %v", err)
	}

	result, _, err := kernel.EvaluateExpression(context.Background(), start.SessionID, "Home", "Navigate(Details)", nil)
	if err != nil {
		t.Fatalf("EvaluateExpression Navigate: %v", err)
	}
	_ = result

	session, ok := kernel.Session(start.SessionID)
	if !ok {
		t.Fatal("expected session to still exist")
	}
	if session.CurrentScreen != "Details" {
		t.Fatalf("expected CurrentScreen=Details after Navigate, got %q", session.CurrentScreen)
	}
	previous, ok := session.State.GetVariable("varPreviousScreen")
	if !ok || previous != "Home" {
		t.Fatalf("expected varPreviousScreen=Home, got %#v ok=%v", previous, ok)
	}
}

func navigationTestPackage(appID uuid.UUID) *Package {
	homeID := uuid.New()
	detailsID := uuid.New()
	return &Package{
		AppID: appID,
		Screens: []RuntimeScreen{
			{ID: homeID, Name: "Home"},
			{ID: detailsID, Name: "Details"},
		},
		ScreensByName: map[string]RuntimeScreen{
			"home":    {ID: homeID, Name: "Home"},
			"details": {ID: detailsID, Name: "Details"},
		},
		Controls: map[string]RuntimeControl{},
	}
}

func TestScreenOnVisibleEvent(t *testing.T) {
	appID := uuid.New()
	kernel := newTestKernel(&fakeMetadataLoader{})
	start, err := kernel.StartSession(context.Background(), uuid.New(), uuid.New(), StartSessionRequest{AppID: appID})
	if err != nil {
		t.Fatalf("StartSession: %v", err)
	}

	session, _ := kernel.Session(start.SessionID)
	if _, ok := session.State.GetVariable("varVisible"); ok {
		t.Fatal("expected OnVisible not run during start without screen")
	}

	_, err = kernel.HandleControlEvent(context.Background(), start.SessionID, ControlEventRequest{
		AppID:  appID,
		Event:  "OnVisible",
		Screen: "Home",
	})
	if err != nil {
		t.Fatalf("OnVisible event: %v", err)
	}

	value, ok := session.State.GetVariable("varVisible")
	if !ok || value != true {
		t.Fatalf("expected varVisible=true, got %#v ok=%v", value, ok)
	}
}
