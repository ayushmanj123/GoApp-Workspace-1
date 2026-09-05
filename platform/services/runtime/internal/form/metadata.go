package form

import (
	"fmt"
	"strings"
)

func stringsTrimSpace(value string) string {
	return strings.TrimSpace(value)
}

// FormulaBinding mirrors cached metadata formula rows.
type FormulaBinding struct {
	PropertyName string
	FormulaText  string
}

// ControlMetadata is the minimum control metadata required for form runtime.
type ControlMetadata struct {
	Name        string
	ControlType string
	Screen      string
	Formulas    []FormulaBinding
	Properties  map[string]interface{}
	EntityNames []string
}

func IsFormControl(controlType string) bool {
	return strings.EqualFold(stringsTrimSpace(controlType), "form")
}

func ReadItemFormula(formulas []FormulaBinding, properties map[string]interface{}) string {
	for _, item := range formulas {
		if strings.EqualFold(item.PropertyName, "item") {
			if text := strings.TrimSpace(item.FormulaText); text != "" {
				return text
			}
		}
	}
	if properties == nil {
		return ""
	}
	raw, ok := properties["item"]
	if !ok {
		return ""
	}
	switch typed := raw.(type) {
	case string:
		return strings.TrimSpace(typed)
	case map[string]interface{}:
		if formula, ok := typed["formula"].(string); ok {
			return strings.TrimSpace(formula)
		}
	}
	return ""
}

func ReadPropertyString(properties map[string]interface{}, propertyName string) string {
	if properties == nil {
		return ""
	}
	raw, ok := properties[propertyName]
	if !ok {
		return ""
	}
	switch typed := raw.(type) {
	case string:
		return strings.TrimSpace(typed)
	case map[string]interface{}:
		if value, ok := typed["value"].(string); ok {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func ReadDataSource(properties map[string]interface{}) string {
	return ReadPropertyString(properties, "dataSource")
}

// ReadRequiredColumns reads optional connector/form required column names
// from properties.requiredColumns (string slice or comma-separated string).
func ReadRequiredColumns(properties map[string]interface{}) []string {
	if properties == nil {
		return nil
	}
	raw, ok := properties["requiredColumns"]
	if !ok {
		return nil
	}
	switch typed := raw.(type) {
	case []string:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			if name := strings.TrimSpace(item); name != "" {
				out = append(out, name)
			}
		}
		return out
	case []interface{}:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			if name := strings.TrimSpace(fmt.Sprint(item)); name != "" && name != "<nil>" {
				out = append(out, name)
			}
		}
		return out
	case string:
		parts := strings.Split(typed, ",")
		out := make([]string, 0, len(parts))
		for _, part := range parts {
			if name := strings.TrimSpace(part); name != "" {
				out = append(out, name)
			}
		}
		return out
	case map[string]interface{}:
		if value, ok := typed["value"].(string); ok {
			return ReadRequiredColumns(map[string]interface{}{"requiredColumns": value})
		}
	}
	return nil
}

func ReadModeProperty(properties map[string]interface{}) Mode {
	if properties == nil {
		return ModeView
	}
	raw, ok := properties["mode"]
	if !ok {
		return ModeView
	}
	switch typed := raw.(type) {
	case string:
		return parseMode(typed)
	case map[string]interface{}:
		if value, ok := typed["value"].(string); ok {
			return parseMode(value)
		}
	}
	return ModeView
}

func parseMode(value string) Mode {
	normalized := strings.ToLower(strings.TrimSpace(value))
	switch normalized {
	case "edit", "edit mode":
		return ModeEdit
	case "new", "new mode":
		return ModeNew
	case "view", "view mode":
		return ModeView
	default:
		if strings.HasPrefix(normalized, "edit") {
			return ModeEdit
		}
		if strings.HasPrefix(normalized, "new") {
			return ModeNew
		}
		if strings.HasPrefix(normalized, "view") {
			return ModeView
		}
		return ModeView
	}
}

func parseGallerySelectedReference(formula string) (string, bool) {
	formula = strings.TrimSpace(formula)
	if !strings.HasSuffix(formula, ".Selected") {
		return "", false
	}
	parts := strings.Split(formula, ".")
	if len(parts) != 2 {
		return "", false
	}
	if parts[1] != "Selected" {
		return "", false
	}
	if parts[0] == "" {
		return "", false
	}
	return parts[0], true
}
