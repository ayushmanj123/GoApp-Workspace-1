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

// ReadFilterFormula returns the filter expression from control formulas or
// properties (e.g. Status='Active'), matching the same lookup order as
// ReadItemsFormula. An empty result leaves any metadata-driven filter
// (resolved from control_properties) untouched.
func ReadFilterFormula(formulas []FormulaBinding, properties map[string]interface{}) string {
	return readStringProp(formulas, properties, "filter")
}

// ReadSortFormula returns the sort expression (e.g. Name Asc) from formulas or properties.
func ReadSortFormula(formulas []FormulaBinding, properties map[string]interface{}) string {
	return readStringProp(formulas, properties, "sort")
}

func ReadLimitProperty(formulas []FormulaBinding, properties map[string]interface{}) int {
	for _, item := range formulas {
		if strings.EqualFold(item.PropertyName, "limit") {
			if n := parsePositiveInt(item.FormulaText); n > 0 {
				return n
			}
		}
	}
	if properties == nil {
		return 0
	}
	raw, ok := properties["limit"]
	if !ok {
		return 0
	}
	switch typed := raw.(type) {
	case float64:
		if typed > 0 {
			return int(typed)
		}
	case int:
		if typed > 0 {
			return typed
		}
	case string:
		return parsePositiveInt(typed)
	case map[string]interface{}:
		if v, ok := typed["value"]; ok {
			switch n := v.(type) {
			case float64:
				if n > 0 {
					return int(n)
				}
			case int:
				if n > 0 {
					return n
				}
			case string:
				return parsePositiveInt(n)
			}
		}
		if formula, ok := typed["formula"].(string); ok {
			return parsePositiveInt(formula)
		}
	}
	return 0
}

// ReadPageSizeProperty returns a positive page size from formulas or properties.
func ReadPageSizeProperty(formulas []FormulaBinding, properties map[string]interface{}) int {
	return readPositiveIntProp(formulas, properties, "pageSize")
}

// ReadOffsetProperty returns a non-negative offset from formulas or properties.
func ReadOffsetProperty(formulas []FormulaBinding, properties map[string]interface{}) int {
	return readPositiveIntProp(formulas, properties, "offset")
}

func readPositiveIntProp(formulas []FormulaBinding, properties map[string]interface{}, name string) int {
	for _, item := range formulas {
		if strings.EqualFold(item.PropertyName, name) {
			if n := parsePositiveInt(item.FormulaText); n > 0 {
				return n
			}
		}
	}
	if properties == nil {
		return 0
	}
	raw, ok := properties[name]
	if !ok {
		return 0
	}
	switch typed := raw.(type) {
	case float64:
		if typed > 0 {
			return int(typed)
		}
	case int:
		if typed > 0 {
			return typed
		}
	case string:
		return parsePositiveInt(typed)
	case map[string]interface{}:
		if v, ok := typed["value"]; ok {
			switch n := v.(type) {
			case float64:
				if n > 0 {
					return int(n)
				}
			case int:
				if n > 0 {
					return n
				}
			case string:
				return parsePositiveInt(n)
			}
		}
		if formula, ok := typed["formula"].(string); ok {
			return parsePositiveInt(formula)
		}
	}
	return 0
}

func readStringProp(formulas []FormulaBinding, properties map[string]interface{}, name string) string {
	for _, item := range formulas {
		if strings.EqualFold(item.PropertyName, name) {
			if text := strings.TrimSpace(item.FormulaText); text != "" {
				return text
			}
		}
	}
	if properties == nil {
		return ""
	}
	raw, ok := properties[name]
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
		if value, ok := typed["value"].(string); ok {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func parsePositiveInt(text string) int {
	text = strings.TrimSpace(text)
	if text == "" {
		return 0
	}
	n := 0
	for _, r := range text {
		if r < '0' || r > '9' {
			return 0
		}
		n = n*10 + int(r-'0')
	}
	return n
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

func IsDataTableControl(controlType string) bool {
	return strings.EqualFold(stringsTrimSpace(controlType), "datatable")
}

func IsItemsControl(controlType string) bool {
	return IsGalleryControl(controlType) || IsDataTableControl(controlType)
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
