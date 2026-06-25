package properties

import (
	"context"
	"testing"

	"github.com/goapps-platform/runtime-service/internal/formula"
	"github.com/goapps-platform/runtime-service/internal/gallery"
	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/goapps-platform/runtime-service/internal/state"
	"github.com/google/uuid"
)

type stubFormulaEvaluator struct {
	values map[string]any
}

func (s stubFormulaEvaluator) Evaluate(rtCtx any, formulaText string) (any, error) {
	if s.values != nil {
		if value, ok := s.values[formulaText]; ok {
			return value, nil
		}
	}
	return formulaText, nil
}

type stubSession struct {
	controls map[string]ControlDefinition
	rtCtx    any
}

func (s stubSession) FormulaContext() any { return s.rtCtx }

func (s stubSession) Control(controlID string) (ControlDefinition, bool) {
	control, ok := s.controls[controlID]
	return control, ok
}

func (s stubSession) ControlsOnScreen(screenID string) []ControlDefinition {
	items := make([]ControlDefinition, 0, len(s.controls))
	for _, control := range s.controls {
		if screenID == "" || control.Screen == screenID {
			items = append(items, control)
		}
	}
	return items
}

func (s stubSession) AllControls() []ControlDefinition {
	return s.ControlsOnScreen("")
}

func TestEvaluateControlLiteralAndFormulaProperties(t *testing.T) {
	engine := NewEngine(stubFormulaEvaluator{values: map[string]any{
		"varSaved": true,
	}}, reactive.NewEngine())
	sessionID := uuid.New()
	session := stubSession{controls: map[string]ControlDefinition{
		"lblStatus": {
			Name: "lblStatus",
			Properties: map[string]interface{}{
				"visible": true,
			},
			Formulas: []FormulaBinding{{
				PropertyName: "Text",
				FormulaText:  "varSaved",
			}},
		},
	}}

	result, err := engine.EvaluateControl(context.Background(), session, sessionID, "lblStatus")
	if err != nil {
		t.Fatalf("EvaluateControl: %v", err)
	}
	if result.Properties["Visible"] != true {
		t.Fatalf("Visible: %#v", result.Properties["Visible"])
	}
	if result.Properties["Text"] != true {
		t.Fatalf("Text: %#v", result.Properties["Text"])
	}
}

func TestEvaluatePropertyUsesCache(t *testing.T) {
	calls := 0
	engine := NewEngine(FormulaEvaluatorAdapter{
		EvaluateFunc: func(rtCtx any, formula string) (any, error) {
			calls++
			return "cached-value", nil
		},
	}, reactive.NewEngine())
	sessionID := uuid.New()
	session := stubSession{controls: map[string]ControlDefinition{
		"lblA": {
			Name: "lblA",
			Formulas: []FormulaBinding{{
				PropertyName: "Text",
				FormulaText:  "varA",
			}},
		},
	}}

	first, err := engine.EvaluateProperty(context.Background(), session, sessionID, "lblA", "Text")
	if err != nil || first != "cached-value" {
		t.Fatalf("first evaluate: %#v %v", first, err)
	}
	second, err := engine.EvaluateProperty(context.Background(), session, sessionID, "lblA", "Text")
	if err != nil || second != "cached-value" {
		t.Fatalf("second evaluate: %#v %v", second, err)
	}
	if calls != 1 {
		t.Fatalf("expected one formula evaluation, got %d", calls)
	}
}

func TestRegisterDependenciesPublishesReactiveMetadata(t *testing.T) {
	reactiveEngine := reactive.NewEngine()
	engine := NewEngine(stubFormulaEvaluator{}, reactiveEngine)
	sessionID := uuid.New()
	controls := []ControlDefinition{{
		Name:   "lblTotal",
		Screen: "Home",
		Formulas: []FormulaBinding{{
			PropertyName: "Text",
			FormulaText:  "varTotal",
		}},
	}}
	engine.RegisterDependencies(sessionID, controls)

	deps := reactiveEngine.Dependencies(sessionID)
	if len(deps) != 1 {
		t.Fatalf("expected reactive dependency, got %#v", deps)
	}
	if !containsString(deps[0].Variables, "varTotal") {
		t.Fatalf("variables: %#v", deps[0].Variables)
	}
}

func TestInvalidateEventForcesReevaluation(t *testing.T) {
	calls := 0
	engine := NewEngine(FormulaEvaluatorAdapter{
		EvaluateFunc: func(rtCtx any, formula string) (any, error) {
			calls++
			return calls, nil
		},
	}, reactive.NewEngine())
	sessionID := uuid.New()
	controls := []ControlDefinition{{
		Name:   "lblCounter",
		Screen: "Home",
		Formulas: []FormulaBinding{{
			PropertyName: "Text",
			FormulaText:  "varCounter",
		}},
	}}
	engine.RegisterDependencies(sessionID, controls)
	session := stubSession{controls: map[string]ControlDefinition{
		"lblCounter": controls[0],
	}}

	_, _ = engine.EvaluateProperty(context.Background(), session, sessionID, "lblCounter", "Text")
	engine.InvalidateEvent(sessionID, reactive.Event{
		Type:    reactive.EventVariableChanged,
		Payload: map[string]any{"name": "varCounter"},
	})
	value, err := engine.EvaluateProperty(context.Background(), session, sessionID, "lblCounter", "Text")
	if err != nil {
		t.Fatalf("reevaluate: %v", err)
	}
	if value != 2 {
		t.Fatalf("expected second evaluation after invalidation, got %#v (calls=%d)", value, calls)
	}
}

func TestEvaluateWithFormulaRuntimeGalleryReference(t *testing.T) {
	stateStore := state.NewMemoryStore()
	appID := uuid.New()
	sessionID := stateStore.CreateSession(appID)
	manager, err := stateStore.GetManager(appID, sessionID)
	if err != nil {
		t.Fatalf("GetManager: %v", err)
	}

	galleryStore := gallery.NewSessionStore()
	galleryStore.Set(sessionID, "Gallery1", &gallery.State{
		Items: []map[string]interface{}{
			{"Name": "Alice"},
		},
		Selected: map[string]interface{}{"Name": "Alice"},
	})
	gallerySvc := gallery.NewService(galleryStore, nil, nil)
	formulaEval := formula.NewEvaluator()

	rtCtx := &formula.RuntimeFormulaContext{
		State:   manager,
		Gallery: gallerySvc.Reader(sessionID),
		Session: formula.SessionContext{SessionID: sessionID, Screen: "Home"},
		App:     formula.AppContext{AppID: appID},
	}

	engine := NewEngine(FormulaEvaluatorAdapter{
		EvaluateFunc: func(ctx any, text string) (any, error) {
			return formulaEval.Evaluate(ctx.(*formula.RuntimeFormulaContext), text)
		},
	}, reactive.NewEngine())

	session := stubSession{
		rtCtx: rtCtx,
		controls: map[string]ControlDefinition{
			"lblCustomer": {
				Name: "lblCustomer",
				Formulas: []FormulaBinding{{
					PropertyName: "Text",
					FormulaText:  "Gallery1.Selected.Name",
				}},
			},
		},
	}

	result, err := engine.EvaluateControl(context.Background(), session, sessionID, "lblCustomer")
	if err != nil {
		t.Fatalf("EvaluateControl: %v", err)
	}
	if result.Properties["Text"] != "Alice" {
		t.Fatalf("Text: %#v", result.Properties["Text"])
	}
}

func TestEvaluateScreenReturnsAllControls(t *testing.T) {
	engine := NewEngine(stubFormulaEvaluator{}, reactive.NewEngine())
	sessionID := uuid.New()
	session := stubSession{controls: map[string]ControlDefinition{
		"lblA": {Name: "lblA", Screen: "Home", Properties: map[string]interface{}{"text": "A"}},
		"lblB": {Name: "lblB", Screen: "Home", Properties: map[string]interface{}{"text": "B"}},
		"lblC": {Name: "lblC", Screen: "Other", Properties: map[string]interface{}{"text": "C"}},
	}}

	screen, err := engine.EvaluateScreen(context.Background(), session, sessionID, "Home")
	if err != nil {
		t.Fatalf("EvaluateScreen: %v", err)
	}
	if len(screen.Controls) != 2 {
		t.Fatalf("expected 2 controls on Home, got %d", len(screen.Controls))
	}
}
