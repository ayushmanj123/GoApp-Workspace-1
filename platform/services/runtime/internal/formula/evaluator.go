package formula

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	runtimemetrics "github.com/goapps-platform/runtime-service/internal/metrics"
)

// Evaluator executes runtime formulas against a RuntimeFormulaContext.
type Evaluator struct {
	dispatcher *Dispatcher
}

func NewEvaluator() *Evaluator {
	return &Evaluator{dispatcher: NewDispatcher()}
}

func (e *Evaluator) Evaluate(rtCtx *RuntimeFormulaContext, formula string) (result any, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = newFormulaError("RUNTIME_ERROR", "formula execution panicked", nil)
		}
	}()
	err = runtimemetrics.TimeFormula("evaluate", func() error {
		var evalErr error
		result, evalErr = e.dispatcher.Dispatch(rtCtx, formula)
		return evalErr
	})
	return result, err
}

type valueEvaluator struct{}

func newValueEvaluator() *valueEvaluator {
	return &valueEvaluator{}
}

func (v *valueEvaluator) evaluate(rtCtx *RuntimeFormulaContext, expression string) (any, error) {
	expression = strings.TrimSpace(expression)
	if expression == "" {
		return nil, newFormulaError("INVALID_FORMULA", "expression is empty", nil)
	}

	if strings.HasPrefix(strings.ToUpper(expression), "FIRST(") {
		return NewDispatcher().execFirst(rtCtx, expression)
	}
	if strings.HasPrefix(strings.ToUpper(expression), "LAST(") {
		return NewDispatcher().execLast(rtCtx, expression)
	}
	if strings.HasPrefix(strings.ToUpper(expression), "COUNTROWS(") {
		return NewDispatcher().execCountRows(rtCtx, expression)
	}
	if strings.HasPrefix(strings.ToUpper(expression), "DEFAULTS(") {
		return NewDispatcher().execDefaults(rtCtx, expression)
	}

	trimmed := strings.TrimSpace(expression)
	if strings.EqualFold(trimmed, "User()") {
		return userRecord(rtCtx), nil
	}
	if strings.HasPrefix(strings.ToUpper(trimmed), "USER().") {
		field := strings.TrimSpace(trimmed[len("User()."):])
		return walkFieldPath(userRecord(rtCtx), strings.Split(field, "."))
	}
	if strings.HasPrefix(trimmed, "User.") {
		return walkFieldPath(userRecord(rtCtx), strings.Split(trimmed[len("User."):], "."))
	}

	switch expression {
	case "true":
		return true, nil
	case "false":
		return false, nil
	}

	if numberLiteralPat.MatchString(expression) {
		if strings.Contains(expression, ".") {
			return strconv.ParseFloat(expression, 64)
		}
		return strconv.Atoi(expression)
	}

	if strings.HasPrefix(expression, `"`) {
		if stringLiteralPat.MatchString(expression) {
			match := stringLiteralPat.FindStringSubmatch(expression)
			return strings.ReplaceAll(match[1], `""`, `"`), nil
		}
		return nil, newFormulaError("INVALID_FORMULA", "invalid string literal", nil)
	}

	if identifierPattern.MatchString(expression) {
		if value, ok := lookupOverlay(rtCtx, expression); ok {
			return value, nil
		}
		if value, ok := rtCtx.State.GetVariable(expression); ok {
			return value, nil
		}
		screen := rtCtx.Session.Screen
		if screen == "" {
			screen = "Default"
		}
		if value, ok := rtCtx.State.GetContext(screen, expression); ok {
			return value, nil
		}
		if items, ok := queryEntityTable(rtCtx, expression); ok {
			return items, nil
		}
		return nil, newFormulaError("RUNTIME_ERROR", "unknown variable: "+expression, nil)
	}

	if referencePattern.MatchString(expression) {
		if rtCtx.Forms != nil {
			if value, ok := rtCtx.Forms.ResolveReference(expression); ok {
				return value, nil
			}
		}
		if rtCtx.Gallery != nil {
			if value, ok := rtCtx.Gallery.ResolveReference(expression); ok {
				return value, nil
			}
		}
		return nil, newFormulaError("RUNTIME_ERROR", "unknown reference: "+expression, nil)
	}

	if strings.Contains(expression, ".") {
		if value, err := v.evaluateDottedPath(rtCtx, expression); err == nil {
			return value, nil
		}
	}

	if value, ok, err := v.evaluateComparison(rtCtx, expression); ok {
		return value, err
	}

	return nil, newFormulaError("INVALID_FORMULA", "unsupported expression: "+expression, nil)
}

func (v *valueEvaluator) evaluateDottedPath(rtCtx *RuntimeFormulaContext, expression string) (any, error) {
	parts := strings.Split(expression, ".")
	if len(parts) < 2 {
		return nil, newFormulaError("INVALID_FORMULA", "invalid reference path", nil)
	}
	if rtCtx.Overlay != nil {
		if root, ok := rtCtx.Overlay[parts[0]]; ok {
			if len(parts) == 1 {
				return root, nil
			}
			if value, err := walkFieldPath(root, parts[1:]); err != nil {
				return nil, err
			} else if value != nil {
				return value, nil
			}
		}
	}
	if len(parts) >= 2 {
		ref := parts[0] + "." + parts[1]
		if rtCtx.Forms != nil {
			if value, ok := rtCtx.Forms.ResolveReference(ref); ok {
				return walkFieldPath(value, parts[2:])
			}
		}
		if rtCtx.Gallery != nil {
			if value, ok := rtCtx.Gallery.ResolveReference(ref); ok {
				return walkFieldPath(value, parts[2:])
			}
		}
	}
	return nil, newFormulaError("RUNTIME_ERROR", "unknown reference: "+expression, nil)
}

func walkFieldPath(value any, parts []string) (any, error) {
	current := value
	for _, part := range parts {
		record, ok := current.(map[string]interface{})
		if !ok {
			return nil, nil
		}
		next, ok := record[part]
		if !ok {
			return nil, nil
		}
		current = next
	}
	return current, nil
}

var comparisonPattern = regexp.MustCompile(`^(.+?)\s*(>=|<=|<>|!=|=|>|<)\s*(.+)$`)

func (v *valueEvaluator) evaluateComparison(rtCtx *RuntimeFormulaContext, expression string) (any, bool, error) {
	match := comparisonPattern.FindStringSubmatch(expression)
	if len(match) != 4 {
		return nil, false, nil
	}
	left, err := v.evaluate(rtCtx, strings.TrimSpace(match[1]))
	if err != nil {
		return nil, true, err
	}
	right, err := v.evaluate(rtCtx, strings.TrimSpace(match[3]))
	if err != nil {
		return nil, true, err
	}
	result, err := compareValues(left, right, match[2])
	return result, true, err
}

func compareValues(left, right any, operator string) (bool, error) {
	switch operator {
	case "=", "==":
		return equalsValue(left, right), nil
	case "!=", "<>":
		return !equalsValue(left, right), nil
	case ">":
		return greaterThan(left, right)
	case ">=":
		gt, err := greaterThan(left, right)
		return gt || equalsValue(left, right), err
	case "<":
		gt, err := greaterThan(right, left)
		return gt, err
	case "<=":
		gt, err := greaterThan(right, left)
		return gt || equalsValue(left, right), err
	default:
		return false, newFormulaError("INVALID_FORMULA", "unsupported comparison operator", nil)
	}
}

func equalsValue(left, right any) bool {
	return fmt.Sprint(left) == fmt.Sprint(right)
}

func greaterThan(left, right any) (bool, error) {
	lv, lok := toFloat64(left)
	rv, rok := toFloat64(right)
	if !lok || !rok {
		return false, newFormulaError("INVALID_FORMULA", "comparison requires numeric values", nil)
	}
	return lv > rv, nil
}

func toFloat64(value any) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return typed, true
	case float32:
		return float64(typed), true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case int32:
		return float64(typed), true
	default:
		return 0, false
	}
}

func userRecord(rtCtx *RuntimeFormulaContext) map[string]interface{} {
	fullName := "User"
	email := ""
	if rtCtx != nil {
		email = strings.TrimSpace(rtCtx.User.Email)
		if email != "" {
			fullName = email
			if at := strings.Index(email, "@"); at > 0 {
				fullName = strings.ReplaceAll(email[:at], ".", " ")
			}
		}
	}
	return map[string]interface{}{
		"FullName": fullName,
		"Email":    email,
		"Name":     fullName,
	}
}

func lookupOverlay(rtCtx *RuntimeFormulaContext, name string) (any, bool) {
	if rtCtx == nil || rtCtx.Overlay == nil {
		return nil, false
	}
	value, ok := rtCtx.Overlay[name]
	return value, ok
}
