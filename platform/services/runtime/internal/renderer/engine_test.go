package renderer

import (
	"context"
	"testing"

	"github.com/goapps-platform/runtime-service/internal/properties"
	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/google/uuid"
)

type stubSession struct {
	screenName string
	controls   map[string]properties.ControlDefinition
}

func (s *stubSession) FormulaContext() any { return nil }

func (s *stubSession) Control(controlID string) (properties.ControlDefinition, bool) {
	control, ok := s.controls[controlID]
	return control, ok
}

func (s *stubSession) ControlsOnScreen(screenID string) []properties.ControlDefinition {
	items := make([]properties.ControlDefinition, 0)
	for _, control := range s.controls {
		if screenID == "" || control.Screen == screenID {
			items = append(items, control)
		}
	}
	return items
}

func (s *stubSession) AllControls() []properties.ControlDefinition {
	return s.ControlsOnScreen("")
}

func (s *stubSession) ScreenName(screenID string) string {
	if s.screenName != "" {
		return s.screenName
	}
	return screenID
}

func TestRenderScreenBuildsControlTree(t *testing.T) {
	props := properties.NewEngine(properties.FormulaEvaluatorAdapter{
		EvaluateFunc: func(rtCtx any, formula string) (any, error) {
			return formula, nil
		},
	}, reactive.NewEngine())
	engine := NewEngine(props)
	sessionID := uuid.New()
	session := &stubSession{
		screenName: "Home",
		controls: map[string]properties.ControlDefinition{
			"Label1": {
				Name:        "Label1",
				ControlType: "Label",
				Screen:      "Home",
				X:           10,
				Y:           20,
				Properties: map[string]interface{}{
					"text": "John",
				},
				Formulas: []properties.FormulaBinding{{
					PropertyName: "Visible",
					FormulaText:  "true",
				}},
			},
		},
	}

	screen, err := engine.RenderScreen(context.Background(), session, sessionID, "Home")
	if err != nil {
		t.Fatalf("RenderScreen: %v", err)
	}
	if screen.Screen != "Home" {
		t.Fatalf("screen name: %s", screen.Screen)
	}
	if len(screen.Controls) != 1 {
		t.Fatalf("expected 1 control, got %d", len(screen.Controls))
	}
	control := screen.Controls[0]
	if control.ID != "Label1" || control.Type != "Label" {
		t.Fatalf("unexpected control: %#v", control)
	}
	if control.Properties["Text"] != "John" && control.Properties["text"] != "John" {
		t.Fatalf("text property: %#v", control.Properties)
	}
}

func TestRenderScreenReusesRendererCache(t *testing.T) {
	props := properties.NewEngine(properties.FormulaEvaluatorAdapter{
		EvaluateFunc: func(rtCtx any, formula string) (any, error) {
			return "evaluated", nil
		},
	}, reactive.NewEngine())
	engine := NewEngine(props)
	sessionID := uuid.New()
	session := &stubSession{
		screenName: "Home",
		controls: map[string]properties.ControlDefinition{
			"Label1": {
				Name:        "Label1",
				ControlType: "Label",
				Screen:      "Home",
				Formulas:    []properties.FormulaBinding{{PropertyName: "Text", FormulaText: "varA"}},
			},
			"Label2": {
				Name:        "Label2",
				ControlType: "Label",
				Screen:      "Home",
				Formulas:    []properties.FormulaBinding{{PropertyName: "Text", FormulaText: "varB"}},
			},
		},
	}

	first, err := engine.RenderScreen(context.Background(), session, sessionID, "Home")
	if err != nil || len(first.Controls) != 2 {
		t.Fatalf("first render: %#v %v", first, err)
	}

	engine.InvalidateControl(sessionID, "Label1")
	second, err := engine.RenderScreen(context.Background(), session, sessionID, "Home")
	if err != nil {
		t.Fatalf("second render: %v", err)
	}
	if len(second.Controls) != 2 {
		t.Fatalf("expected 2 controls, got %d", len(second.Controls))
	}
}

func TestRenderControlsIncremental(t *testing.T) {
	props := properties.NewEngine(properties.FormulaEvaluatorAdapter{
		EvaluateFunc: func(rtCtx any, formula string) (any, error) {
			return formula, nil
		},
	}, reactive.NewEngine())
	engine := NewEngine(props)
	sessionID := uuid.New()
	session := &stubSession{
		screenName: "Home",
		controls: map[string]properties.ControlDefinition{
			"Label1": {Name: "Label1", ControlType: "Label", Screen: "Home", Properties: map[string]interface{}{"text": "A"}},
			"Label2": {Name: "Label2", ControlType: "Label", Screen: "Home", Properties: map[string]interface{}{"text": "B"}},
		},
	}

	_, _ = engine.RenderScreen(context.Background(), session, sessionID, "Home")
	partial, err := engine.RenderControls(context.Background(), session, sessionID, "Home", []string{"Label2"})
	if err != nil {
		t.Fatalf("RenderControls: %v", err)
	}
	if len(partial.Controls) != 1 || partial.Controls[0].ID != "Label2" {
		t.Fatalf("unexpected partial render: %#v", partial)
	}
}

func TestRendererCacheInvalidatesOnVariableEvent(t *testing.T) {
	engine := NewEngine(properties.NewEngine(properties.FormulaEvaluatorAdapter{
		EvaluateFunc: func(rtCtx any, formula string) (any, error) { return formula, nil },
	}, reactive.NewEngine()))
	sessionID := uuid.New()
	controls := []properties.ControlDefinition{{
		Name: "Label1", Screen: "Home", ControlType: "Label",
		Formulas: []properties.FormulaBinding{{PropertyName: "Text", FormulaText: "varA"}},
	}}
	engine.RegisterDependencies(sessionID, controls)

	session := &stubSession{screenName: "Home", controls: map[string]properties.ControlDefinition{"Label1": controls[0]}}
	_, _ = engine.RenderScreen(context.Background(), session, sessionID, "Home")

	engine.InvalidateEvent(sessionID, reactive.Event{
		Type:    reactive.EventVariableChanged,
		Payload: map[string]any{"name": "varA"},
	})
	if _, ok := engine.cache.Get(sessionID, "Home", "Label1"); ok {
		t.Fatal("renderer cache should invalidate on variable event")
	}
}

func TestRendererCacheInvalidatesOnGalleryEvent(t *testing.T) {
	engine := NewEngine(properties.NewEngine(properties.FormulaEvaluatorAdapter{
		EvaluateFunc: func(rtCtx any, formula string) (any, error) { return formula, nil },
	}, reactive.NewEngine()))
	sessionID := uuid.New()
	controls := []properties.ControlDefinition{{
		Name: "Label1", Screen: "Home", ControlType: "Label",
		Formulas: []properties.FormulaBinding{{PropertyName: "Text", FormulaText: "Gallery1.Selected.Name"}},
	}}
	engine.RegisterDependencies(sessionID, controls)
	session := &stubSession{screenName: "Home", controls: map[string]properties.ControlDefinition{"Label1": controls[0]}}
	_, _ = engine.RenderScreen(context.Background(), session, sessionID, "Home")

	engine.InvalidateEvent(sessionID, reactive.Event{
		Type:    reactive.EventGallerySelectionChanged,
		Payload: map[string]any{"gallery": "Gallery1"},
	})
	if _, ok := engine.cache.Get(sessionID, "Home", "Label1"); ok {
		t.Fatal("renderer cache should invalidate on gallery event")
	}
}
