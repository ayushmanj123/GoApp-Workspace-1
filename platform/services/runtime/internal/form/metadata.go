package form

import (
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

func ReadDataSource(properties map[string]interface{}) string {
	if properties == nil {
		return ""
	}
	if value, ok := properties["dataSource"].(string); ok {
		return strings.TrimSpace(value)
	}
	return ""
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
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "edit":
		return ModeEdit
	case "new":
		return ModeNew
	default:
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
