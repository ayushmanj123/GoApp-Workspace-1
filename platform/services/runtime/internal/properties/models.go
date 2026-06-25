package properties

import (
	"github.com/google/uuid"
)

// ValueType identifies how a property value is stored in metadata.
type ValueType string

const (
	ValueTypeLiteral  ValueType = "literal"
	ValueTypeFormula  ValueType = "formula"
	ValueTypeBoolean  ValueType = "boolean"
	ValueTypeNumber   ValueType = "number"
	ValueTypeColor    ValueType = "color"
	ValueTypeObject   ValueType = "object"
	ValueTypeArray    ValueType = "array"
	ValueTypeEnum     ValueType = "enum"
)

// Supported property names evaluated by the runtime engine.
var SupportedProperties = []string{
	"Text", "Visible", "DisplayMode", "Default", "Items",
	"Width", "Height", "X", "Y", "Fill", "Color",
}

// Binding is a resolved metadata property definition.
type Binding struct {
	Name      string
	ValueType ValueType
	Formula   string
	Literal   any
}

// ControlDefinition is cached control metadata for property evaluation.
type ControlDefinition struct {
	ID          uuid.UUID
	Name        string
	ControlType string
	ScreenID    uuid.UUID
	Screen      string
	X           int
	Y           int
	Width       int
	Height      int
	Formulas    []FormulaBinding
	Properties  map[string]interface{}
}

// FormulaBinding binds a property to a formula expression.
type FormulaBinding struct {
	PropertyName string
	FormulaText  string
	FormulaType  string
}

// ScreenDefinition identifies a runtime screen.
type ScreenDefinition struct {
	ID   uuid.UUID
	Name string
}

// EvaluatedControl is the evaluated property bag for one control.
type EvaluatedControl struct {
	ControlID  string                 `json:"controlId"`
	Properties map[string]interface{} `json:"properties"`
}

// EvaluatedScreen contains evaluated properties for all controls on a screen.
type EvaluatedScreen struct {
	ScreenID   string             `json:"screenId"`
	Controls   []EvaluatedControl `json:"controls"`
}

// PropertyDependency captures reactive dependencies for one control property.
type PropertyDependency struct {
	ControlID   string
	Screen      string
	Property    string
	Variables   []string
	Collections []string
	DataSources []string
	Galleries   []string
	Forms       []string
	ContextKeys []string
}

// EvaluationContext provides runtime services for property evaluation.
type EvaluationContext struct {
	FormulaContext any
	Evaluator      FormulaEvaluator
}

// FormulaEvaluator executes formulas against a runtime context.
type FormulaEvaluator interface {
	Evaluate(rtCtx any, formula string) (any, error)
}

// SessionAccess exposes session-scoped metadata and runtime context.
type SessionAccess interface {
	FormulaContext() any
	Control(controlID string) (ControlDefinition, bool)
	ControlsOnScreen(screenID string) []ControlDefinition
	AllControls() []ControlDefinition
}
