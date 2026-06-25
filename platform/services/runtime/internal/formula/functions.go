package formula

import (
	"regexp"
	"strconv"
	"strings"
)

var (
	identifierPattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9]*$`)
	referencePattern  = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)?$`)
	stringLiteralPat  = regexp.MustCompile(`^"((?:[^"]|"")*)"$`)
	numberLiteralPat  = regexp.MustCompile(`^-?\d+(\.\d+)?$`)
)

func findFirstTopLevelComma(s string) int {
	depth := 0
	inString := false
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case inString:
			if c == '"' {
				inString = false
			}
		case c == '"':
			inString = true
		case c == '(' || c == '{' || c == '[':
			depth++
		case c == ')' || c == '}' || c == ']':
			depth--
		case c == ',' && depth == 0:
			return i
		}
	}
	return -1
}

func parseCallContent(formula string) (name string, content string, ok bool) {
	trimmed := strings.TrimSpace(formula)
	open := strings.Index(trimmed, "(")
	close := strings.LastIndex(trimmed, ")")
	if open == -1 || close <= open {
		return "", "", false
	}
	name = strings.TrimSpace(trimmed[:open])
	content = strings.TrimSpace(trimmed[open+1 : close])
	return name, content, true
}

func parseRecordObject(objectLiteral string) (map[string]interface{}, error) {
	trimmed := strings.TrimSpace(objectLiteral)
	if !strings.HasPrefix(trimmed, "{") || !strings.HasSuffix(trimmed, "}") {
		return nil, newFormulaError("INVALID_FORMULA", "expected record object literal", nil)
	}
	body := strings.TrimSpace(trimmed[1 : len(trimmed)-1])
	if body == "" {
		return map[string]interface{}{}, nil
	}

	record := map[string]interface{}{}
	index := 0
	for index < len(body) {
		rest := body[index:]
		if match := regexp.MustCompile(`^\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*"((?:[^"]|"")*)"\s*(?:,\s*)?`).FindStringSubmatch(rest); len(match) == 3 {
			record[match[1]] = strings.ReplaceAll(match[2], `""`, `"`)
			index += len(match[0])
			continue
		}
		if match := regexp.MustCompile(`(?i)^\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*(true|false)\s*(?:,\s*)?`).FindStringSubmatch(rest); len(match) == 3 {
			record[match[1]] = strings.EqualFold(match[2], "true")
			index += len(match[0])
			continue
		}
		if match := regexp.MustCompile(`^\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*(-?\d+(?:\.\d+)?)\s*(?:,\s*)?`).FindStringSubmatch(rest); len(match) == 3 {
			if strings.Contains(match[2], ".") {
				value, _ := strconv.ParseFloat(match[2], 64)
				record[match[1]] = value
			} else {
				value, _ := strconv.Atoi(match[2])
				record[match[1]] = value
			}
			index += len(match[0])
			continue
		}
		return nil, newFormulaError("INVALID_FORMULA", "unsupported record field syntax", intPtr(index))
	}
	return record, nil
}

func parseSetFormula(formula string) (varName string, valueExpr string, ok bool) {
	name, content, ok := parseCallContent(formula)
	if !ok || !strings.EqualFold(name, "Set") {
		return "", "", false
	}
	comma := findFirstTopLevelComma(content)
	if comma == -1 {
		return "", "", false
	}
	varName = strings.TrimSpace(content[:comma])
	valueExpr = strings.TrimSpace(content[comma+1:])
	if !identifierPattern.MatchString(varName) || valueExpr == "" {
		return "", "", false
	}
	return varName, valueExpr, true
}

func parseTwoArgCall(formula, expectedName string) (first string, second string, ok bool) {
	name, content, ok := parseCallContent(formula)
	if !ok || !strings.EqualFold(name, expectedName) {
		return "", "", false
	}
	comma := findFirstTopLevelComma(content)
	if comma == -1 {
		return "", "", false
	}
	first = strings.TrimSpace(content[:comma])
	second = strings.TrimSpace(content[comma+1:])
	if !identifierPattern.MatchString(first) || second == "" {
		return "", "", false
	}
	return first, second, true
}

func parseSingleIdentifierCall(formula, expectedName string) (arg string, ok bool) {
	name, content, ok := parseCallContent(formula)
	if !ok || !strings.EqualFold(name, expectedName) {
		return "", false
	}
	arg = strings.TrimSpace(content)
	if !referencePattern.MatchString(arg) {
		return "", false
	}
	return arg, true
}

func parseIfFormula(formula string) (condition, trueExpr, falseExpr string, ok bool) {
	name, content, ok := parseCallContent(formula)
	if !ok || !strings.EqualFold(name, "If") {
		return "", "", "", false
	}
	comma := findFirstTopLevelComma(content)
	if comma == -1 {
		return "", "", "", false
	}
	rest := strings.TrimSpace(content[comma+1:])
	comma2 := findFirstTopLevelComma(rest)
	if comma2 == -1 {
		return "", "", "", false
	}
	condition = strings.TrimSpace(content[:comma])
	trueExpr = strings.TrimSpace(rest[:comma2])
	falseExpr = strings.TrimSpace(rest[comma2+1:])
	if condition == "" || trueExpr == "" || falseExpr == "" {
		return "", "", "", false
	}
	return condition, trueExpr, falseExpr, true
}

func parseUpdateContextFormula(formula string) (map[string]interface{}, bool) {
	name, content, ok := parseCallContent(formula)
	if !ok || !strings.EqualFold(name, "UpdateContext") {
		return nil, false
	}
	record, err := parseRecordObject(content)
	if err != nil {
		return nil, false
	}
	return record, true
}

func intPtr(v int) *int {
	return &v
}

func splitStatements(formula string) []string {
	parts := make([]string, 0)
	depth := 0
	inString := false
	start := 0
	for i := 0; i < len(formula); i++ {
		c := formula[i]
		switch {
		case inString:
			if c == '"' {
				inString = false
			}
		case c == '"':
			inString = true
		case c == '(' || c == '{' || c == '[':
			depth++
		case c == ')' || c == '}' || c == ']':
			if depth > 0 {
				depth--
			}
		case c == ';' && depth == 0:
			part := strings.TrimSpace(formula[start:i])
			if part != "" {
				parts = append(parts, part)
			}
			start = i + 1
		}
	}
	if tail := strings.TrimSpace(formula[start:]); tail != "" {
		parts = append(parts, tail)
	}
	return parts
}
