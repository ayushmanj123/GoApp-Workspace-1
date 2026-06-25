package properties

import (
	"regexp"
	"strings"

	"github.com/goapps-platform/runtime-service/internal/reactive"
)

var (
	countRowsPat     = regexp.MustCompile(`(?i)CountRows\s*\(\s*([A-Za-z][A-Za-z0-9_.]*)\s*\)`)
	gallerySelected  = regexp.MustCompile(`([A-Za-z][A-Za-z0-9]*)\.Selected(?:\.[A-Za-z][A-Za-z0-9_]*)?`)
	formReferencePat = regexp.MustCompile(`([A-Za-z][A-Za-z0-9]*)\.(Item|Mode|Valid|Unsaved)(?:\.[A-Za-z][A-Za-z0-9_]*)?`)
	identifierPat      = regexp.MustCompile(`\b([A-Za-z][A-Za-z0-9_]*)\b`)
)

// ResolveBindings merges control properties and formulas into evaluable bindings.
func ResolveBindings(control ControlDefinition) map[string]Binding {
	bindings := map[string]Binding{}
	for key, raw := range control.Properties {
		if binding, ok := bindingFromRaw(key, raw); ok {
			bindings[normalizePropertyName(key)] = binding
		}
	}
	for _, item := range control.Formulas {
		if isBehaviorFormula(item) {
			continue
		}
		name := normalizePropertyName(item.PropertyName)
		if strings.TrimSpace(item.FormulaText) == "" {
			continue
		}
		bindings[name] = Binding{
			Name:      name,
			ValueType: ValueTypeFormula,
			Formula:   strings.TrimSpace(item.FormulaText),
		}
	}
	applyLayoutBindings(control, bindings)
	return bindings
}

func isBehaviorFormula(item FormulaBinding) bool {
	if strings.EqualFold(strings.TrimSpace(item.FormulaType), "behavior") {
		return true
	}
	name := strings.TrimSpace(item.PropertyName)
	return strings.HasPrefix(strings.ToLower(name), "on")
}

func applyLayoutBindings(control ControlDefinition, bindings map[string]Binding) {
	setLayoutBinding := func(name string, value int) {
		if _, ok := bindings[name]; ok {
			return
		}
		bindings[name] = Binding{Name: name, ValueType: ValueTypeNumber, Literal: value}
	}
	setLayoutBinding("X", control.X)
	setLayoutBinding("Y", control.Y)
	setLayoutBinding("Width", control.Width)
	setLayoutBinding("Height", control.Height)
}

func bindingFromRaw(name string, raw interface{}) (Binding, bool) {
	name = normalizePropertyName(name)
	switch typed := raw.(type) {
	case string:
		if strings.HasPrefix(strings.TrimSpace(typed), "#") {
			return Binding{Name: name, ValueType: ValueTypeColor, Literal: typed}, true
		}
		return Binding{Name: name, ValueType: ValueTypeLiteral, Literal: typed}, true
	case bool:
		return Binding{Name: name, ValueType: ValueTypeBoolean, Literal: typed}, true
	case float64:
		return Binding{Name: name, ValueType: ValueTypeNumber, Literal: typed}, true
	case int:
		return Binding{Name: name, ValueType: ValueTypeNumber, Literal: typed}, true
	case map[string]interface{}:
		if formula, ok := typed["formula"].(string); ok && strings.TrimSpace(formula) != "" {
			return Binding{Name: name, ValueType: ValueTypeFormula, Formula: strings.TrimSpace(formula)}, true
		}
		if kind, ok := typed["kind"].(string); ok && strings.EqualFold(kind, "enum") {
			if value, ok := typed["value"]; ok {
				if binding, ok := bindingFromLiteralValue(name, value); ok {
					binding.ValueType = ValueTypeEnum
					return binding, true
				}
			}
		}
		if value, ok := typed["value"]; ok {
			return bindingFromLiteralValue(name, value)
		}
		return Binding{Name: name, ValueType: ValueTypeObject, Literal: typed}, true
	case []interface{}:
		return Binding{Name: name, ValueType: ValueTypeArray, Literal: typed}, true
	default:
		return Binding{}, false
	}
}

func bindingFromLiteralValue(name string, value interface{}) (Binding, bool) {
	switch typed := value.(type) {
	case string:
		if strings.HasPrefix(strings.TrimSpace(typed), "#") {
			return Binding{Name: name, ValueType: ValueTypeColor, Literal: typed}, true
		}
		return Binding{Name: name, ValueType: ValueTypeLiteral, Literal: typed}, true
	case bool:
		return Binding{Name: name, ValueType: ValueTypeBoolean, Literal: typed}, true
	case float64:
		return Binding{Name: name, ValueType: ValueTypeNumber, Literal: typed}, true
	case int:
		return Binding{Name: name, ValueType: ValueTypeNumber, Literal: typed}, true
	default:
		return Binding{Name: name, ValueType: ValueTypeLiteral, Literal: value}, true
	}
}

func normalizePropertyName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return name
	}
	return strings.ToUpper(name[:1]) + name[1:]
}

// AnalyzeControlDependencies derives reactive dependencies from property formulas.
func AnalyzeControlDependencies(control ControlDefinition) []PropertyDependency {
	dependencies := make([]PropertyDependency, 0)
	for name, binding := range ResolveBindings(control) {
		if binding.ValueType != ValueTypeFormula || strings.TrimSpace(binding.Formula) == "" {
			continue
		}
		dependencies = append(dependencies, PropertyDependency{
			ControlID:   control.Name,
			Screen:      control.Screen,
			Property:    name,
			Variables:   extractVariables(binding.Formula),
			Collections: extractCollections(binding.Formula),
			DataSources: extractDataSources(binding.Formula),
			Galleries:   extractGalleries(binding.Formula),
			Forms:       extractForms(binding.Formula),
			ContextKeys: extractContextKeys(binding.Formula),
		})
	}
	return dependencies
}

// MergeControlDependencies converts property dependencies into reactive control dependencies.
func MergeControlDependencies(controls []ControlDefinition) []reactive.ControlDependency {
	byControl := map[string]*reactive.ControlDependency{}
	for _, control := range controls {
		for _, dep := range AnalyzeControlDependencies(control) {
			entry := byControl[dep.ControlID]
			if entry == nil {
				entry = &reactive.ControlDependency{ControlID: dep.ControlID, Screen: dep.Screen}
				byControl[dep.ControlID] = entry
			}
			entry.Variables = appendUnique(entry.Variables, dep.Variables...)
			entry.Collections = appendUnique(entry.Collections, dep.Collections...)
			entry.DataSources = appendUnique(entry.DataSources, dep.DataSources...)
			entry.Galleries = appendUnique(entry.Galleries, dep.Galleries...)
			entry.Forms = appendUnique(entry.Forms, dep.Forms...)
			entry.ContextKeys = appendUnique(entry.ContextKeys, dep.ContextKeys...)
		}
	}
	result := make([]reactive.ControlDependency, 0, len(byControl))
	for _, dep := range byControl {
		result = append(result, *dep)
	}
	return result
}

func extractVariables(formula string) []string {
	return extractBareIdentifiers(formula)
}

func extractCollections(formula string) []string {
	collections := make([]string, 0)
	for _, match := range countRowsPat.FindAllStringSubmatch(formula, -1) {
		if len(match) > 1 {
			ref := strings.TrimSpace(match[1])
			if !strings.Contains(ref, ".") {
				collections = appendUnique(collections, ref)
			}
		}
	}
	return collections
}

func extractDataSources(formula string) []string {
	formula = strings.TrimSpace(formula)
	if formula == "" {
		return nil
	}
	if identifierPat.MatchString(formula) && !strings.Contains(formula, ".") && !isReservedWord(strings.ToLower(formula)) {
		return []string{formula}
	}
	return nil
}

func extractGalleries(formula string) []string {
	galleries := make([]string, 0)
	for _, match := range gallerySelected.FindAllStringSubmatch(formula, -1) {
		if len(match) > 1 {
			galleries = appendUnique(galleries, match[1])
		}
	}
	return galleries
}

func extractForms(formula string) []string {
	forms := make([]string, 0)
	for _, match := range formReferencePat.FindAllStringSubmatch(formula, -1) {
		if len(match) > 1 {
			forms = appendUnique(forms, match[1])
		}
	}
	return forms
}

func extractContextKeys(formula string) []string {
	return extractBareIdentifiers(formula)
}

func extractBareIdentifiers(formula string) []string {
	known := map[string]struct{}{}
	for _, match := range countRowsPat.FindAllStringSubmatch(formula, -1) {
		if len(match) > 1 {
			known[strings.ToLower(match[1])] = struct{}{}
		}
	}
	for _, match := range gallerySelected.FindAllStringSubmatch(formula, -1) {
		if len(match) > 1 {
			known[strings.ToLower(match[1])] = struct{}{}
		}
	}
	for _, match := range formReferencePat.FindAllStringSubmatch(formula, -1) {
		if len(match) > 1 {
			known[strings.ToLower(match[1])] = struct{}{}
		}
	}
	identifiers := make([]string, 0)
	for _, token := range identifierPat.FindAllString(formula, -1) {
		lower := strings.ToLower(token)
		if isReservedWord(lower) {
			continue
		}
		if _, skip := known[lower]; skip {
			continue
		}
		if strings.Contains(lower, ".") {
			continue
		}
		identifiers = appendUnique(identifiers, token)
	}
	return identifiers
}

func isReservedWord(word string) bool {
	switch strings.ToLower(word) {
	case "true", "false", "set", "collect", "clearcollect", "patch", "navigate", "countrows", "first", "last", "defaults", "if", "user", "edit", "disabled", "view", "new":
		return true
	default:
		return false
	}
}

func appendUnique(values []string, items ...string) []string {
	seen := map[string]struct{}{}
	for _, value := range values {
		seen[strings.ToLower(value)] = struct{}{}
	}
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		key := strings.ToLower(item)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		values = append(values, item)
	}
	return values
}
