package form

import (
	"regexp"
	"strconv"
	"strings"
)

var (
	firstCallPat  = regexp.MustCompile(`(?i)^First\s*\(\s*([A-Za-z][A-Za-z0-9_]*)\s*\)$`)
	lookUpCallPat = regexp.MustCompile(`(?i)^LookUp\s*\(\s*([A-Za-z][A-Za-z0-9_]*)\s*,`)
)

func parseFirstDataSourceCall(formula string) (string, bool) {
	match := firstCallPat.FindStringSubmatch(strings.TrimSpace(formula))
	if len(match) != 2 {
		return "", false
	}
	return match[1], true
}

func parseLookUpDataSource(formula string) (string, bool) {
	match := lookUpCallPat.FindStringSubmatch(strings.TrimSpace(formula))
	if len(match) != 2 {
		return "", false
	}
	return match[1], true
}

// parseExplicitRecordLiteral parses a simple { Field: "value", ... } object.
func parseExplicitRecordLiteral(formula string) (map[string]interface{}, error) {
	trimmed := strings.TrimSpace(formula)
	if !strings.HasPrefix(trimmed, "{") || !strings.HasSuffix(trimmed, "}") {
		return nil, errNotRecordLiteral
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
		return nil, errNotRecordLiteral
	}
	return record, nil
}

type notRecordLiteralError struct{}

func (notRecordLiteralError) Error() string { return "not a record literal" }

var errNotRecordLiteral = notRecordLiteralError{}

// ReadBehaviorFormula returns OnSuccess / OnFailure formula text from form metadata.
func ReadBehaviorFormula(formulas []FormulaBinding, properties map[string]interface{}, propertyName string) string {
	propertyName = strings.TrimSpace(propertyName)
	for _, item := range formulas {
		if strings.EqualFold(item.PropertyName, propertyName) {
			if text := strings.TrimSpace(item.FormulaText); text != "" {
				return text
			}
		}
	}
	if properties == nil {
		return ""
	}
	for key, raw := range properties {
		if !strings.EqualFold(key, propertyName) {
			continue
		}
		switch typed := raw.(type) {
		case string:
			return strings.TrimSpace(typed)
		case map[string]interface{}:
			if formula, ok := typed["formula"].(string); ok {
				return strings.TrimSpace(formula)
			}
		}
	}
	return ""
}
