package reactive

import (
	"strings"
)

func resolveRefresh(controls []ControlDependency, event Event) []RefreshInstruction {
	seen := map[string]struct{}{}
	refresh := make([]RefreshInstruction, 0)
	for _, control := range controls {
		if !controlDependsOnEvent(control, event) {
			continue
		}
		if _, ok := seen[control.ControlID]; ok {
			continue
		}
		seen[control.ControlID] = struct{}{}
		refresh = append(refresh, RefreshInstruction{
			ControlID: control.ControlID,
			Reason:    string(event.Type),
		})
	}
	return refresh
}

func controlDependsOnEvent(control ControlDependency, event Event) bool {
	switch event.Type {
	case EventVariableChanged:
		name := payloadString(event.Payload, "name")
		return containsString(control.Variables, name)
	case EventCollectionChanged:
		name := payloadString(event.Payload, "name")
		return containsString(control.Collections, name)
	case EventDatasourceChanged:
		name := payloadString(event.Payload, "name")
		return containsString(control.DataSources, name)
	case EventContextChanged:
		screen := payloadString(event.Payload, "screen")
		if control.Screen != "" && screen != "" && !strings.EqualFold(control.Screen, screen) {
			return false
		}
		keys := payloadStringSlice(event.Payload, "keys")
		if len(keys) == 0 {
			return len(control.ContextKeys) > 0
		}
		for _, key := range keys {
			if containsString(control.ContextKeys, key) {
				return true
			}
		}
		return false
	case EventNavigationRequested:
		screen := payloadString(event.Payload, "screen")
		return control.Screen != "" && strings.EqualFold(control.Screen, screen)
	case EventFormulaExecuted:
		return false
	case EventGallerySelectionChanged:
		gallery := payloadString(event.Payload, "gallery")
		return containsString(control.Galleries, gallery)
	case EventFormChanged:
		form := payloadString(event.Payload, "form")
		return containsString(control.Forms, form)
	default:
		return false
	}
}

func payloadString(payload map[string]any, key string) string {
	if payload == nil {
		return ""
	}
	value, ok := payload[key]
	if !ok {
		return ""
	}
	text, ok := value.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(text)
}

func payloadStringSlice(payload map[string]any, key string) []string {
	if payload == nil {
		return nil
	}
	value, ok := payload[key]
	if !ok {
		return nil
	}
	switch typed := value.(type) {
	case []string:
		return typed
	case []any:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			if text, ok := item.(string); ok {
				out = append(out, text)
			}
		}
		return out
	default:
		return nil
	}
}

func containsString(values []string, target string) bool {
	target = strings.TrimSpace(target)
	if target == "" {
		return false
	}
	for _, value := range values {
		if strings.EqualFold(strings.TrimSpace(value), target) {
			return true
		}
	}
	return false
}
