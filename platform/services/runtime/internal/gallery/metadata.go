package gallery

import (
	"strings"
)

func stringsTrimSpace(value string) string {
	return strings.TrimSpace(value)
}

// ReadItemsFormula returns the items expression from control formulas or properties.
func ReadItemsFormula(formulas []FormulaBinding, properties map[string]interface{}) string {
	for _, item := range formulas {
		if strings.EqualFold(item.PropertyName, "items") {
			if text := strings.TrimSpace(item.FormulaText); text != "" {
				return text
			}
		}
	}
	if properties == nil {
		return ""
	}
	raw, ok := properties["items"]
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

// FormulaBinding mirrors cached metadata formula rows for gallery resolution.
type FormulaBinding struct {
	PropertyName string
	FormulaText  string
}

// ControlMetadata is the minimum control metadata required to resolve gallery items.
type ControlMetadata struct {
	Name         string
	ControlType  string
	Screen       string
	Formulas     []FormulaBinding
	Properties   map[string]interface{}
	EntityNames  []string
}

func IsGalleryControl(controlType string) bool {
	return strings.EqualFold(stringsTrimSpace(controlType), "gallery")
}

func isBareIdentifier(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return false
	}
	for index, r := range value {
		if index == 0 {
			if r != '_' && (r < 'A' || r > 'Z') && (r < 'a' || r > 'z') {
				return false
			}
			continue
		}
		if r != '_' && (r < '0' || r > '9') && (r < 'A' || r > 'Z') && (r < 'a' || r > 'z') {
			return false
		}
	}
	return true
}

func isEntitySource(source string, entities []string) bool {
	source = strings.TrimSpace(source)
	for _, entity := range entities {
		if strings.EqualFold(entity, source) {
			return true
		}
	}
	return false
}
