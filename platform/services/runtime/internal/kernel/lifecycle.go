package kernel

import (
	"context"
	"regexp"
	"strings"

	"github.com/goapps-platform/runtime-service/internal/form"
	"github.com/goapps-platform/runtime-service/internal/gallery"
	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/google/uuid"
)

var setVariablePat = regexp.MustCompile(`(?i)^Set\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,`)

func (k *RuntimeKernel) runScreenVisible(ctx context.Context, session *RuntimeSession, screenName string) (reactive.RefreshResponse, error) {
	if session == nil || session.Package == nil {
		return reactive.RefreshResponse{}, ErrFormulaNotFound
	}
	screen, ok := session.Package.ScreensByName[strings.ToLower(strings.TrimSpace(screenName))]
	if !ok {
		return reactive.RefreshResponse{}, ErrFormulaNotFound
	}
	if screen.OnVisible == nil || strings.TrimSpace(*screen.OnVisible) == "" {
		return reactive.RefreshResponse{}, nil
	}
	_, refresh, err := k.executeFormula(ctx, session, screen.Name, strings.TrimSpace(*screen.OnVisible))
	if err != nil {
		return reactive.RefreshResponse{}, err
	}
	return reactive.RefreshResponse{Refresh: refresh}, nil
}

func buildDependencies(pkg *Package) []reactive.ControlDependency {
	if pkg == nil {
		return nil
	}
	byID := map[uuid.UUID]RuntimeControl{}
	for _, control := range pkg.Controls {
		if control.ID == uuid.Nil {
			continue
		}
		byID[control.ID] = control
	}

	dependencies := make([]reactive.ControlDependency, 0, len(byID))
	for _, control := range byID {
		dependencies = append(dependencies, extractControlDependency(control))
	}
	return dependencies
}

func mergeReactiveDependencies(primary, secondary []reactive.ControlDependency) []reactive.ControlDependency {
	byControl := map[string]*reactive.ControlDependency{}
	for _, dep := range primary {
		copy := dep
		byControl[strings.ToLower(dep.ControlID)] = &copy
	}
	for _, dep := range secondary {
		key := strings.ToLower(dep.ControlID)
		entry := byControl[key]
		if entry == nil {
			copy := dep
			byControl[key] = &copy
			continue
		}
		entry.Variables = appendUnique(entry.Variables, dep.Variables...)
		entry.Collections = appendUnique(entry.Collections, dep.Collections...)
		entry.DataSources = appendUnique(entry.DataSources, dep.DataSources...)
		entry.Galleries = appendUnique(entry.Galleries, dep.Galleries...)
		entry.Forms = appendUnique(entry.Forms, dep.Forms...)
		if entry.Screen == "" {
			entry.Screen = dep.Screen
		}
	}
	result := make([]reactive.ControlDependency, 0, len(byControl))
	for _, dep := range byControl {
		result = append(result, *dep)
	}
	return result
}

func extractControlDependency(control RuntimeControl) reactive.ControlDependency {
	dep := reactive.ControlDependency{
		ControlID: control.Name,
		Screen:    control.Screen,
	}
	if gallery.IsGalleryControl(control.ControlType) {
		source := gallery.ReadItemsFormula(toGalleryFormulas(control.Formulas), control.Properties)
		if source != "" {
			dep.Collections = appendUnique(dep.Collections, source)
			dep.DataSources = appendUnique(dep.DataSources, source)
		}
	}
	if form.IsFormControl(control.ControlType) {
		if source := form.ReadDataSource(control.Properties); source != "" {
			dep.DataSources = appendUnique(dep.DataSources, source)
		}
	}
	for _, item := range control.Formulas {
		switch strings.ToLower(item.PropertyName) {
		case "text", "visible", "value":
			dep.Variables = appendUnique(dep.Variables, extractSetVariables(item.FormulaText)...)
			dep.Variables = appendUnique(dep.Variables, extractIdentifier(item.FormulaText))
		case "items":
			name := strings.TrimSpace(item.FormulaText)
			if name != "" {
				dep.Collections = appendUnique(dep.Collections, name)
				dep.DataSources = appendUnique(dep.DataSources, name)
			}
		}
	}
	if control.Properties != nil {
		if value, ok := control.Properties["dataSource"].(string); ok && strings.TrimSpace(value) != "" {
			dep.DataSources = appendUnique(dep.DataSources, strings.TrimSpace(value))
		}
		if value, ok := control.Properties["items"].(string); ok && strings.TrimSpace(value) != "" {
			dep.Collections = appendUnique(dep.Collections, strings.TrimSpace(value))
			dep.DataSources = appendUnique(dep.DataSources, strings.TrimSpace(value))
		}
	}
	dep.Galleries = appendUnique(dep.Galleries, extractGalleryReferences(control)...)
	dep.Forms = appendUnique(dep.Forms, extractFormReferences(control)...)
	return dep
}

func toGalleryFormulas(formulas []RuntimeFormula) []gallery.FormulaBinding {
	items := make([]gallery.FormulaBinding, 0, len(formulas))
	for _, formula := range formulas {
		items = append(items, gallery.FormulaBinding{
			PropertyName: formula.PropertyName,
			FormulaText:  formula.FormulaText,
		})
	}
	return items
}

var galleryReferencePat = regexp.MustCompile(`([A-Za-z][A-Za-z0-9]*)\.Selected`)

func extractGalleryReferences(control RuntimeControl) []string {
	references := []string{}
	for _, item := range control.Formulas {
		for _, match := range galleryReferencePat.FindAllStringSubmatch(item.FormulaText, -1) {
			if len(match) > 1 {
				references = appendUnique(references, match[1])
			}
		}
		if ref := extractIdentifier(item.FormulaText); strings.Contains(ref, ".Selected") {
			parts := strings.Split(ref, ".")
			if len(parts) > 0 {
				references = appendUnique(references, parts[0])
			}
		}
	}
	return references
}

var formReferencePat = regexp.MustCompile(`([A-Za-z][A-Za-z0-9]*)\.(Mode|Valid|Unsaved|Item)`)

func extractFormReferences(control RuntimeControl) []string {
	references := []string{}
	for _, item := range control.Formulas {
		for _, match := range formReferencePat.FindAllStringSubmatch(item.FormulaText, -1) {
			if len(match) > 1 {
				references = appendUnique(references, match[1])
			}
		}
	}
	return references
}

func extractSetVariables(formulaText string) []string {
	match := setVariablePat.FindStringSubmatch(strings.TrimSpace(formulaText))
	if len(match) < 2 {
		return nil
	}
	return []string{match[1]}
}

var identifierPat = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

func extractIdentifier(expression string) string {
	expression = strings.TrimSpace(expression)
	if identifierPat.MatchString(expression) {
		return expression
	}
	return ""
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

func eventPropertyName(event string) string {
	event = strings.TrimSpace(event)
	if event == "" {
		return ""
	}
	if strings.HasPrefix(event, "On") && len(event) > 2 {
		return "on" + event[2:]
	}
	return strings.ToLower(event)
}
