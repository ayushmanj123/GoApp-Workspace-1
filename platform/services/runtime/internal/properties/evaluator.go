package properties

import (
	"fmt"
	"strings"
)

// PropertyEvaluator evaluates individual property bindings.
type PropertyEvaluator struct {
	formula FormulaEvaluator
}

func NewPropertyEvaluator(formula FormulaEvaluator) *PropertyEvaluator {
	return &PropertyEvaluator{formula: formula}
}

func (e *PropertyEvaluator) Evaluate(binding Binding, rtCtx any) (interface{}, error) {
	if e == nil {
		return nil, fmt.Errorf("property evaluator is unavailable")
	}
	switch binding.ValueType {
	case ValueTypeFormula:
		if strings.TrimSpace(binding.Formula) == "" {
			return nil, nil
		}
		if e.formula == nil {
			return nil, fmt.Errorf("formula runtime is unavailable")
		}
		return e.formula.Evaluate(rtCtx, binding.Formula)
	default:
		return binding.Literal, nil
	}
}

func normalizeEvaluatedValue(value interface{}) interface{} {
	if value == nil {
		return nil
	}
	switch typed := value.(type) {
	case bool, float64, int, int64, map[string]interface{}, []interface{}:
		return typed
	case string:
		return typed
	default:
		return fmt.Sprint(typed)
	}
}
