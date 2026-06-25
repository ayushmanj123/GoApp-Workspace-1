package properties

import (
	"testing"

	"github.com/google/uuid"
)

func TestResolveBindingsLiteralProperties(t *testing.T) {
	control := ControlDefinition{
		Name: "lblTitle",
		Properties: map[string]interface{}{
			"text":    "Hello",
			"visible": true,
			"color":   "#FF0000",
			"width":   120,
		},
	}
	bindings := ResolveBindings(control)
	if bindings["Text"].Literal != "Hello" {
		t.Fatalf("Text: got %#v", bindings["Text"].Literal)
	}
	if bindings["Visible"].ValueType != ValueTypeBoolean || bindings["Visible"].Literal != true {
		t.Fatalf("Visible: got %#v", bindings["Visible"])
	}
	if bindings["Color"].ValueType != ValueTypeColor {
		t.Fatalf("Color type: %s", bindings["Color"].ValueType)
	}
	if bindings["Width"].Literal != 120 {
		t.Fatalf("Width: got %#v", bindings["Width"].Literal)
	}
}

func TestResolveBindingsFormulaOverridesLiteral(t *testing.T) {
	control := ControlDefinition{
		Name: "lblStatus",
		Properties: map[string]interface{}{
			"text": "Static",
		},
		Formulas: []FormulaBinding{{
			PropertyName: "text",
			FormulaText:  "varSaved",
		}},
	}
	bindings := ResolveBindings(control)
	if bindings["Text"].ValueType != ValueTypeFormula || bindings["Text"].Formula != "varSaved" {
		t.Fatalf("expected formula binding, got %#v", bindings["Text"])
	}
}

func TestResolveBindingsLayoutFromMetadata(t *testing.T) {
	control := ControlDefinition{
		Name:   "btnSave",
		X:      10,
		Y:      20,
		Width:  100,
		Height: 40,
	}
	bindings := ResolveBindings(control)
	if bindings["X"].Literal != 10 || bindings["Y"].Literal != 20 {
		t.Fatalf("layout position: %#v %#v", bindings["X"], bindings["Y"])
	}
	if bindings["Width"].Literal != 100 || bindings["Height"].Literal != 40 {
		t.Fatalf("layout size: %#v %#v", bindings["Width"], bindings["Height"])
	}
}

func TestResolveBindingsIncludesZeroLayout(t *testing.T) {
	control := ControlDefinition{Name: "lblOrigin"}
	bindings := ResolveBindings(control)
	for _, key := range []string{"X", "Y", "Width", "Height"} {
		if _, ok := bindings[key]; !ok {
			t.Fatalf("%s: expected binding", key)
		}
		if bindings[key].Literal != 0 {
			t.Fatalf("%s: expected 0, got %#v", key, bindings[key].Literal)
		}
	}
}

func TestResolveBindingsSkipsBehaviorFormulas(t *testing.T) {
	control := ControlDefinition{
		Name: "btnSave",
		Formulas: []FormulaBinding{
			{PropertyName: "onSelect", FormulaText: `Navigate(Home)`, FormulaType: "behavior"},
			{PropertyName: "Text", FormulaText: "varTitle"},
		},
	}
	bindings := ResolveBindings(control)
	if _, ok := bindings["OnSelect"]; ok {
		t.Fatal("behavior formula should not become a render binding")
	}
	if bindings["Text"].Formula != "varTitle" {
		t.Fatalf("property formula missing: %#v", bindings["Text"])
	}
}

func TestAnalyzeControlDependenciesGalleryAndForm(t *testing.T) {
	control := ControlDefinition{
		ID:     uuid.New(),
		Name:   "lblCustomer",
		Screen: "Home",
		Formulas: []FormulaBinding{
			{PropertyName: "Text", FormulaText: "Gallery1.Selected.Name"},
			{PropertyName: "Visible", FormulaText: "CountRows(colOrders)>0"},
			{PropertyName: "Default", FormulaText: "Form1.Item.Name"},
		},
	}
	deps := AnalyzeControlDependencies(control)
	if len(deps) != 3 {
		t.Fatalf("expected 3 property dependencies, got %d", len(deps))
	}
	byProperty := map[string]PropertyDependency{}
	for _, dep := range deps {
		byProperty[dep.Property] = dep
	}
	if !containsString(byProperty["Text"].Galleries, "Gallery1") {
		t.Fatalf("Text gallery deps: %#v", byProperty["Text"].Galleries)
	}
	if !containsString(byProperty["Visible"].Collections, "colOrders") {
		t.Fatalf("Visible collection deps: %#v", byProperty["Visible"].Collections)
	}
	if !containsString(byProperty["Default"].Forms, "Form1") {
		t.Fatalf("Default form deps: %#v", byProperty["Default"].Forms)
	}
}

func TestMergeControlDependenciesRegistersReactiveShape(t *testing.T) {
	controls := []ControlDefinition{{
		Name:   "lblTotal",
		Screen: "Home",
		Formulas: []FormulaBinding{{
			PropertyName: "Text",
			FormulaText:  "varTotal",
		}},
	}}
	merged := MergeControlDependencies(controls)
	if len(merged) != 1 {
		t.Fatalf("expected 1 control dependency, got %d", len(merged))
	}
	if merged[0].ControlID != "lblTotal" {
		t.Fatalf("control id: %s", merged[0].ControlID)
	}
	if !containsString(merged[0].Variables, "varTotal") {
		t.Fatalf("variables: %#v", merged[0].Variables)
	}
}
