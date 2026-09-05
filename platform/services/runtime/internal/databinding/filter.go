package databinding

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// CompareOp is a leaf comparison operator in a filter predicate.
type CompareOp string

const (
	OpEQ         CompareOp = "="
	OpNE         CompareOp = "<>"
	OpGT         CompareOp = ">"
	OpGTE        CompareOp = ">="
	OpLT         CompareOp = "<"
	OpLTE        CompareOp = "<="
	OpContains   CompareOp = "contains"
	OpStartsWith CompareOp = "startswith"
	OpEndsWith   CompareOp = "endswith"
)

// FilterCombinator joins leaf comparisons (shallow And/Or of leaves only).
type FilterCombinator string

const (
	CombinatorAnd FilterCombinator = "And"
	CombinatorOr  FilterCombinator = "Or"
)

// ComparisonFilter is a single field comparison leaf.
type ComparisonFilter struct {
	Field string
	Op    CompareOp
	Value string
}

// FilterExpr is a shallow And/Or of comparison leaves (Phase 7.19).
type FilterExpr struct {
	Combinator FilterCombinator
	Leaves     []ComparisonFilter
}

// Empty reports whether the expression has no leaves (no filter).
func (e FilterExpr) Empty() bool {
	return len(e.Leaves) == 0
}

// IsEqualsAndOnly reports whether every leaf is `=` and the combinator is And
// (or a single leaf). Used by REST to decide query-param push vs in-memory.
func (e FilterExpr) IsEqualsAndOnly() bool {
	if e.Empty() {
		return true
	}
	if e.Combinator == CombinatorOr && len(e.Leaves) > 1 {
		return false
	}
	for _, leaf := range e.Leaves {
		if leaf.Op != OpEQ {
			return false
		}
	}
	return true
}

// EqualsFilter is kept for callers that only need equals/`And` leaves.
type EqualsFilter struct {
	Field string
	Value string
}

// comparisonFilterPattern matches Field <op> 'value' | "value" | number.
// Longer operators must be listed first in the alternation.
var comparisonFilterPattern = regexp.MustCompile(
	`^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(<>|>=|<=|=|>|<)\s*(?:['"]([^'"]*)['"]|([0-9]+(?:\.[0-9]+)?))\s*$`,
)

// containsStartsWithPattern matches Contains/StartsWith/EndsWith(Field,'value').
var containsStartsWithPattern = regexp.MustCompile(
	`(?i)^\s*(Contains|StartsWith|EndsWith)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*(?:['"]([^'"]*)['"])\s*\)\s*$`,
)

// ParseFilterExpr parses gallery / LookUp / Filter predicates.
// Supported forms:
//   - Status='Active'
//   - Amount=10
//   - Status<>'X'
//   - Contains(Name,'acme')
//   - StartsWith(Name,'A')
//   - EndsWith(Name,'Inc')
//   - Status='Active' And Region='West'
//   - And(Status='Active', Region='West')
//   - Status='A' Or Status='B'
//   - Or(Status='A', Status='B')
//
// Mixed infix And/Or in one expression is rejected (shallow leaves only).
func ParseFilterExpr(expression string) (FilterExpr, error) {
	expression = strings.TrimSpace(expression)
	if expression == "" {
		return FilterExpr{}, nil
	}

	upper := strings.ToUpper(expression)
	if strings.HasPrefix(upper, "AND(") && strings.HasSuffix(expression, ")") {
		return parseCombinatorCall(expression, CombinatorAnd, 4)
	}
	if strings.HasPrefix(upper, "OR(") && strings.HasSuffix(expression, ")") {
		return parseCombinatorCall(expression, CombinatorOr, 3)
	}

	if hasTopLevelKeyword(expression, "Or") {
		if hasTopLevelKeyword(expression, "And") {
			return FilterExpr{}, fmt.Errorf("%w: mixed And/Or without And()/Or() grouping: %q", ErrInvalidFilter, expression)
		}
		parts := splitTopLevelKeyword(expression, "Or")
		leaves, err := parseLeafParts(parts)
		if err != nil {
			return FilterExpr{}, err
		}
		return FilterExpr{Combinator: CombinatorOr, Leaves: leaves}, nil
	}

	parts := splitTopLevelKeyword(expression, "And")
	leaves, err := parseLeafParts(parts)
	if err != nil {
		return FilterExpr{}, err
	}
	return FilterExpr{Combinator: CombinatorAnd, Leaves: leaves}, nil
}

// ParseEqualsFilter parses equals/`And` predicates and returns []EqualsFilter.
// Non-equals or Or expressions return ErrInvalidFilter.
func ParseEqualsFilter(expression string) ([]EqualsFilter, error) {
	expr, err := ParseFilterExpr(expression)
	if err != nil {
		return nil, err
	}
	if expr.Empty() {
		return nil, nil
	}
	if !expr.IsEqualsAndOnly() {
		return nil, fmt.Errorf("%w: equals/And only: %q", ErrInvalidFilter, expression)
	}
	out := make([]EqualsFilter, 0, len(expr.Leaves))
	for _, leaf := range expr.Leaves {
		out = append(out, EqualsFilter{Field: leaf.Field, Value: leaf.Value})
	}
	return out, nil
}

func parseCombinatorCall(expression string, combinator FilterCombinator, prefixLen int) (FilterExpr, error) {
	inner := strings.TrimSpace(expression[prefixLen : len(expression)-1])
	parts := splitTopLevelComma(inner)
	if len(parts) == 0 {
		return FilterExpr{}, fmt.Errorf("%w: %q", ErrInvalidFilter, expression)
	}
	leaves, err := parseLeafParts(parts)
	if err != nil {
		return FilterExpr{}, err
	}
	return FilterExpr{Combinator: combinator, Leaves: leaves}, nil
}

func parseLeafParts(parts []string) ([]ComparisonFilter, error) {
	leaves := make([]ComparisonFilter, 0, len(parts))
	for _, part := range parts {
		one, err := parseComparisonLeaf(part)
		if err != nil {
			return nil, err
		}
		leaves = append(leaves, one)
	}
	return leaves, nil
}

func parseComparisonLeaf(expression string) (ComparisonFilter, error) {
	expression = strings.TrimSpace(expression)
	if matches := containsStartsWithPattern.FindStringSubmatch(expression); len(matches) == 4 {
		op := OpContains
		if strings.EqualFold(matches[1], "StartsWith") {
			op = OpStartsWith
		} else if strings.EqualFold(matches[1], "EndsWith") {
			op = OpEndsWith
		}
		return ComparisonFilter{
			Field: matches[2],
			Op:    op,
			Value: matches[3],
		}, nil
	}
	matches := comparisonFilterPattern.FindStringSubmatch(expression)
	if len(matches) != 5 {
		return ComparisonFilter{}, fmt.Errorf("%w: %q", ErrInvalidFilter, expression)
	}
	value := matches[3]
	if value == "" {
		value = matches[4]
	}
	return ComparisonFilter{
		Field: matches[1],
		Op:    CompareOp(matches[2]),
		Value: value,
	}, nil
}

// MatchFilterExpr evaluates a shallow FilterExpr against a row map.
func MatchFilterExpr(data map[string]interface{}, expr FilterExpr) bool {
	if expr.Empty() {
		return true
	}
	if expr.Combinator == CombinatorOr {
		for _, leaf := range expr.Leaves {
			if matchComparison(data, leaf) {
				return true
			}
		}
		return false
	}
	for _, leaf := range expr.Leaves {
		if !matchComparison(data, leaf) {
			return false
		}
	}
	return true
}

func matchComparison(data map[string]interface{}, leaf ComparisonFilter) bool {
	value, ok := data[leaf.Field]
	if !ok {
		return false
	}
	switch leaf.Op {
	case OpEQ:
		return valuesEqual(value, leaf.Value)
	case OpNE:
		return !valuesEqual(value, leaf.Value)
	case OpGT, OpGTE, OpLT, OpLTE:
		return compareOrdered(value, leaf.Value, leaf.Op)
	case OpContains:
		return strings.Contains(strings.ToLower(fmt.Sprintf("%v", value)), strings.ToLower(leaf.Value))
	case OpStartsWith:
		return strings.HasPrefix(strings.ToLower(fmt.Sprintf("%v", value)), strings.ToLower(leaf.Value))
	case OpEndsWith:
		return strings.HasSuffix(strings.ToLower(fmt.Sprintf("%v", value)), strings.ToLower(leaf.Value))
	default:
		return false
	}
}

func compareOrdered(actual interface{}, expected string, op CompareOp) bool {
	if left, right, ok := asFloats(actual, expected); ok {
		switch op {
		case OpGT:
			return left > right
		case OpGTE:
			return left >= right
		case OpLT:
			return left < right
		case OpLTE:
			return left <= right
		}
	}
	left := fmt.Sprintf("%v", actual)
	right := expected
	switch op {
	case OpGT:
		return left > right
	case OpGTE:
		return left >= right
	case OpLT:
		return left < right
	case OpLTE:
		return left <= right
	}
	return false
}

func asFloats(actual interface{}, expected string) (float64, float64, bool) {
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

func hasTopLevelKeyword(s, keyword string) bool {
	depth := 0
	inString := false
	quote := byte(0)
	for i := 0; i < len(s); {
		c := s[i]
		if inString {
			if c == quote {
				inString = false
			}
			i++
			continue
		}
		switch c {
		case '\'', '"':
			inString = true
			quote = c
			i++
		case '(':
			depth++
			i++
		case ')':
			if depth > 0 {
				depth--
			}
			i++
		default:
			if depth == 0 && keywordAt(s, i, keyword) {
				return true
			}
			i++
		}
	}
	return false
}

func splitTopLevelKeyword(s, keyword string) []string {
	var parts []string
	depth := 0
	inString := false
	quote := byte(0)
	start := 0
	kwLen := len(keyword)
	for i := 0; i < len(s); {
		c := s[i]
		if inString {
			if c == quote {
				inString = false
			}
			i++
			continue
		}
		switch c {
		case '\'', '"':
			inString = true
			quote = c
			i++
		case '(':
			depth++
			i++
		case ')':
			if depth > 0 {
				depth--
			}
			i++
		default:
			if depth == 0 && keywordAt(s, i, keyword) {
				parts = append(parts, strings.TrimSpace(s[start:i]))
				i += kwLen
				for i < len(s) && s[i] == ' ' {
					i++
				}
				start = i
				continue
			}
			i++
		}
	}
	parts = append(parts, strings.TrimSpace(s[start:]))
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func keywordAt(s string, i int, keyword string) bool {
	kwLen := len(keyword)
	if i+kwLen > len(s) {
		return false
	}
	if !strings.EqualFold(s[i:i+kwLen], keyword) {
		return false
	}
	if i > 0 {
		prev := s[i-1]
		if (prev >= 'A' && prev <= 'Z') || (prev >= 'a' && prev <= 'z') || (prev >= '0' && prev <= '9') || prev == '_' {
			return false
		}
	}
	if i+kwLen < len(s) {
		next := s[i+kwLen]
		if (next >= 'A' && next <= 'Z') || (next >= 'a' && next <= 'z') || (next >= '0' && next <= '9') || next == '_' {
			return false
		}
	}
	return true
}

func splitTopLevelComma(s string) []string {
	var parts []string
	depth := 0
	inString := false
	quote := byte(0)
	start := 0
	for i := 0; i < len(s); i++ {
		c := s[i]
		if inString {
			if c == quote {
				inString = false
			}
			continue
		}
		switch c {
		case '\'', '"':
			inString = true
			quote = c
		case '(':
			depth++
		case ')':
			if depth > 0 {
				depth--
			}
		case ',':
			if depth == 0 {
				parts = append(parts, strings.TrimSpace(s[start:i]))
				start = i + 1
			}
		}
	}
	parts = append(parts, strings.TrimSpace(s[start:]))
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func sqlOperator(op CompareOp) (string, error) {
	switch op {
	case OpEQ:
		return "=", nil
	case OpNE:
		return "<>", nil
	case OpGT:
		return ">", nil
	case OpGTE:
		return ">=", nil
	case OpLT:
		return "<", nil
	case OpLTE:
		return "<=", nil
	case OpContains:
		return "ILIKE", nil
	case OpStartsWith:
		return "ILIKE", nil
	case OpEndsWith:
		return "ILIKE", nil
	default:
		return "", fmt.Errorf("%w: unsupported op %q", ErrInvalidFilter, op)
	}
}

func sqlFilterValue(leaf ComparisonFilter) string {
	switch leaf.Op {
	case OpContains:
		return "%" + leaf.Value + "%"
	case OpStartsWith:
		return leaf.Value + "%"
	case OpEndsWith:
		return "%" + leaf.Value
	default:
		return leaf.Value
	}
}
