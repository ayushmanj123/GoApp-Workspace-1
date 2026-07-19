package records

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"gorm.io/gorm"
)

// FilterExpr is a shallow And/Or of comparison leaves pushed into List WHERE.
// Mirrors databinding.FilterExpr without importing databinding (avoids a cycle).
type FilterExpr struct {
	Combinator string // "And" or "Or"
	Leaves     []FilterLeaf
}

// FilterLeaf is a single field comparison.
type FilterLeaf struct {
	Field string
	Op    string // = <> > >= < <=
	Value string
}

// Empty reports whether the expression has no leaves.
func (e FilterExpr) Empty() bool {
	return len(e.Leaves) == 0
}

var filterFieldNamePattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

func validateFilterExpr(expr FilterExpr, schema *EntitySchema) error {
	if expr.Empty() {
		return nil
	}
	combinator := strings.TrimSpace(expr.Combinator)
	if combinator == "" {
		combinator = "And"
	}
	if !strings.EqualFold(combinator, "And") && !strings.EqualFold(combinator, "Or") {
		return &ValidationError{Message: "filter combinator must be And or Or"}
	}
	fieldByName := map[string]struct{}{}
	if schema != nil {
		for _, field := range schema.Fields {
			fieldByName[field.Name] = struct{}{}
		}
	}
	for _, leaf := range expr.Leaves {
		field := strings.TrimSpace(leaf.Field)
		if !filterFieldNamePattern.MatchString(field) {
			return &ValidationError{Field: field, Message: "invalid filter field"}
		}
		if schema != nil {
			if _, ok := fieldByName[field]; !ok {
				return &ValidationError{Field: field, Message: "unknown filter field"}
			}
		}
		if _, err := sqlCompareOp(leaf.Op); err != nil {
			return &ValidationError{Field: field, Message: err.Error()}
		}
	}
	return nil
}

func sqlCompareOp(op string) (string, error) {
	switch strings.TrimSpace(op) {
	case "=", "<>", ">", ">=", "<", "<=", "contains", "startswith":
		return strings.TrimSpace(op), nil
	default:
		return "", fmt.Errorf("unsupported filter operator %q", op)
	}
}

// applyFilterExpr adds JSONB predicates to a GORM query (Postgres).
func applyFilterExpr(db *gorm.DB, expr FilterExpr) (*gorm.DB, error) {
	if expr.Empty() {
		return db, nil
	}
	clause, args, err := buildJSONBFilterClause(expr)
	if err != nil {
		return nil, err
	}
	if clause == "" {
		return db, nil
	}
	return db.Where(clause, args...), nil
}

// buildJSONBFilterClause builds a parameterized WHERE fragment for entity_records.data.
func buildJSONBFilterClause(expr FilterExpr) (string, []interface{}, error) {
	if expr.Empty() {
		return "", nil, nil
	}
	parts := make([]string, 0, len(expr.Leaves))
	args := make([]interface{}, 0, len(expr.Leaves))
	for _, leaf := range expr.Leaves {
		field := strings.TrimSpace(leaf.Field)
		if !filterFieldNamePattern.MatchString(field) {
			return "", nil, &ValidationError{Field: field, Message: "invalid filter field"}
		}
		op, err := sqlCompareOp(leaf.Op)
		if err != nil {
			return "", nil, &ValidationError{Field: field, Message: err.Error()}
		}
		fieldLit := quoteLiteral(field)
		left := fmt.Sprintf("(data->>%s)", fieldLit)
		value := leaf.Value
		switch op {
		case "contains":
			parts = append(parts, fmt.Sprintf("LOWER(%s) LIKE LOWER(?)", left))
			args = append(args, "%"+value+"%")
			continue
		case "startswith":
			parts = append(parts, fmt.Sprintf("LOWER(%s) LIKE LOWER(?)", left))
			args = append(args, value+"%")
			continue
		}
		if isOrderedOp(op) && isNumericLiteral(leaf.Value) {
			left = fmt.Sprintf("(data->>%s)::numeric", fieldLit)
		}
		parts = append(parts, fmt.Sprintf("%s %s ?", left, op))
		args = append(args, leaf.Value)
	}
	joiner := " AND "
	if strings.EqualFold(strings.TrimSpace(expr.Combinator), "Or") {
		joiner = " OR "
	}
	return strings.Join(parts, joiner), args, nil
}

func isOrderedOp(op string) bool {
	switch op {
	case ">", ">=", "<", "<=":
		return true
	default:
		return false
	}
}

func isNumericLiteral(value string) bool {
	_, err := strconv.ParseFloat(value, 64)
	return err == nil
}

// MatchFilterExpr evaluates FilterExpr against a row map (used by fakes / tests).
func MatchFilterExpr(data map[string]interface{}, expr FilterExpr) bool {
	if expr.Empty() {
		return true
	}
	if strings.EqualFold(strings.TrimSpace(expr.Combinator), "Or") {
		for _, leaf := range expr.Leaves {
			if matchFilterLeaf(data, leaf) {
				return true
			}
		}
		return false
	}
	for _, leaf := range expr.Leaves {
		if !matchFilterLeaf(data, leaf) {
			return false
		}
	}
	return true
}

func matchFilterLeaf(data map[string]interface{}, leaf FilterLeaf) bool {
	value, ok := data[leaf.Field]
	if !ok {
		return false
	}
	op := strings.TrimSpace(leaf.Op)
	switch op {
	case "=":
		return filterValuesEqual(value, leaf.Value)
	case "<>":
		return !filterValuesEqual(value, leaf.Value)
	case ">", ">=", "<", "<=":
		return filterCompareOrdered(value, leaf.Value, op)
	case "contains":
		return strings.Contains(strings.ToLower(fmt.Sprintf("%v", value)), strings.ToLower(leaf.Value))
	case "startswith":
		return strings.HasPrefix(strings.ToLower(fmt.Sprintf("%v", value)), strings.ToLower(leaf.Value))
	default:
		return false
	}
}

func filterValuesEqual(actual interface{}, expected string) bool {
	switch v := actual.(type) {
	case string:
		return v == expected
	case bool:
		return strings.EqualFold(expected, fmt.Sprintf("%t", v))
	case float64:
		return fmt.Sprintf("%v", v) == expected || fmt.Sprintf("%.0f", v) == expected
	case int:
		return fmt.Sprintf("%d", v) == expected
	case int64:
		return fmt.Sprintf("%d", v) == expected
	default:
		return fmt.Sprintf("%v", v) == expected
	}
}

func filterCompareOrdered(actual interface{}, expected, op string) bool {
	if left, right, ok := filterAsFloats(actual, expected); ok {
		switch op {
		case ">":
			return left > right
		case ">=":
			return left >= right
		case "<":
			return left < right
		case "<=":
			return left <= right
		}
	}
	left := fmt.Sprintf("%v", actual)
	switch op {
	case ">":
		return left > expected
	case ">=":
		return left >= expected
	case "<":
		return left < expected
	case "<=":
		return left <= expected
	}
	return false
}

func filterAsFloats(actual interface{}, expected string) (float64, float64, bool) {
	right, err := strconv.ParseFloat(expected, 64)
	if err != nil {
		return 0, 0, false
	}
	switch v := actual.(type) {
	case float64:
		return v, right, true
	case float32:
		return float64(v), right, true
	case int:
		return float64(v), right, true
	case int64:
		return float64(v), right, true
	case int32:
		return float64(v), right, true
	case string:
		left, err := strconv.ParseFloat(v, 64)
		if err != nil {
			return 0, 0, false
		}
		return left, right, true
	default:
		left, err := strconv.ParseFloat(fmt.Sprintf("%v", v), 64)
		if err != nil {
			return 0, 0, false
		}
		return left, right, true
	}
}
