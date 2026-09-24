package services

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/goapps-platform/metadata-service/internal/api/contracts"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/google/uuid"
)

type componentSnapshotControl struct {
	LocalID       string                 `json:"local_id"`
	ParentLocalID *string                `json:"parent_local_id"`
	ControlType   string                 `json:"control_type"`
	Name          string                 `json:"name"`
	X             float64                `json:"x"`
	Y             float64                `json:"y"`
	Width         float64                `json:"width"`
	Height        float64                `json:"height"`
	ZIndex        int                    `json:"z_index"`
	Properties    map[string]interface{} `json:"properties,omitempty"`
}

type componentCustomProperty struct {
	Name      string `json:"name"`
	Direction string `json:"direction"`
	DataType  string `json:"dataType"`
	Formula   string `json:"formula,omitempty"`
}

type componentDefinitionPayload struct {
	Properties []componentCustomProperty  `json:"properties,omitempty"`
	Controls   []componentSnapshotControl `json:"controls"`
}

func indexComponentDefinitions(defs []models.ComponentDefinition) map[string]componentDefinitionPayload {
	out := make(map[string]componentDefinitionPayload, len(defs))
	for _, def := range defs {
		var payload componentDefinitionPayload
		if err := json.Unmarshal(def.DefinitionJSON, &payload); err != nil {
			continue
		}
		out[def.ID.String()] = payload
	}
	return out
}

func readDefinitionID(properties map[string]interface{}) string {
	if properties == nil {
		return ""
	}
	raw, ok := properties["definition_id"]
	if !ok {
		return ""
	}
	switch v := raw.(type) {
	case string:
		return strings.TrimSpace(v)
	case map[string]interface{}:
		if value, ok := v["value"].(string); ok {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func expandComponentInstances(flat []contracts.RuntimeControl, defs []models.ComponentDefinition) ([]contracts.RuntimeControl, error) {
	if len(defs) == 0 {
		return flat, nil
	}
	defIndex := indexComponentDefinitions(defs)
	if len(defIndex) == 0 {
		return flat, nil
	}

	expanded := make([]contracts.RuntimeControl, 0, len(flat))
	for _, control := range flat {
		expanded = append(expanded, control)
		if strings.TrimSpace(strings.ToLower(control.ControlType)) != "component" {
			continue
		}
		definitionID := readDefinitionID(control.Properties)
		if definitionID == "" {
			continue
		}
		payload, ok := defIndex[definitionID]
		if !ok || len(payload.Controls) == 0 {
			continue
		}
		expanded[len(expanded)-1].Properties = stampComponentContract(control.Properties, payload.Properties)
		children, err := materializeComponentChildren(expanded[len(expanded)-1], payload)
		if err != nil {
			return nil, err
		}
		expanded = append(expanded, children...)
	}
	return expanded, nil
}

func stampComponentContract(properties map[string]interface{}, contract []componentCustomProperty) map[string]interface{} {
	next := map[string]interface{}{}
	for key, value := range properties {
		next[key] = value
	}
	if len(contract) == 0 {
		return next
	}
	raw := make([]interface{}, 0, len(contract))
	for _, property := range contract {
		raw = append(raw, map[string]interface{}{
			"name":      property.Name,
			"direction": property.Direction,
			"dataType":  property.DataType,
			"formula":   property.Formula,
		})
	}
	next["component_contract"] = map[string]interface{}{"value": raw}
	return next
}

func materializeComponentChildren(instance contracts.RuntimeControl, payload componentDefinitionPayload) ([]contracts.RuntimeControl, error) {
	localToID := make(map[string]uuid.UUID, len(payload.Controls))
	for _, snapshot := range payload.Controls {
		if strings.TrimSpace(snapshot.LocalID) == "" {
			return nil, fmt.Errorf("component definition control missing local_id")
		}
		if _, exists := localToID[snapshot.LocalID]; exists {
			return nil, fmt.Errorf("duplicate component local_id %s", snapshot.LocalID)
		}
		localToID[snapshot.LocalID] = uuid.New()
	}

	out := make([]contracts.RuntimeControl, 0, len(payload.Controls))
	for _, snapshot := range payload.Controls {
		id := localToID[snapshot.LocalID]
		var parentID *uuid.UUID
		if snapshot.ParentLocalID != nil && strings.TrimSpace(*snapshot.ParentLocalID) != "" {
			mapped, ok := localToID[strings.TrimSpace(*snapshot.ParentLocalID)]
			if !ok {
				return nil, fmt.Errorf("component definition missing parent %s", *snapshot.ParentLocalID)
			}
			parentID = &mapped
		} else {
			parentID = &instance.ID
		}
		properties := substituteComponentProperties(snapshot.Properties, instance.Properties, payload.Properties)
		if properties == nil {
			properties = map[string]interface{}{}
		}
		properties["component_instance_id"] = map[string]interface{}{"value": instance.ID.String()}
		out = append(out, contracts.RuntimeControl{
			ID:              id,
			ScreenID:        instance.ScreenID,
			ParentControlID: parentID,
			ControlType:     snapshot.ControlType,
			Name:            snapshot.Name,
			X:               snapshot.X,
			Y:               snapshot.Y,
			Width:           snapshot.Width,
			Height:          snapshot.Height,
			ZIndex:          snapshot.ZIndex,
			Properties:      properties,
		})
	}
	return out, nil
}

func substituteComponentProperties(properties map[string]interface{}, instance map[string]interface{}, contract []componentCustomProperty) map[string]interface{} {
	if len(properties) == 0 {
		return properties
	}
	next := map[string]interface{}{}
	for key, value := range properties {
		next[key] = substituteComponentValue(value, instance, contract)
	}
	return next
}

func substituteComponentValue(value interface{}, instance map[string]interface{}, contract []componentCustomProperty) interface{} {
	bag, ok := value.(map[string]interface{})
	if !ok {
		return value
	}
	formula, _ := bag["formula"].(string)
	name := componentReferenceName(formula)
	if name == "" {
		return value
	}
	replacement, ok := lookupInstanceProperty(instance, name)
	if !ok || !shouldBindInstanceProperty(name, replacement, contract) {
		return value
	}
	return replacement
}

func shouldBindInstanceProperty(name string, replacement interface{}, contract []componentCustomProperty) bool {
	switch propertyDirection(contract, name) {
	case "action":
		return true
	case "output":
		return false
	}
	bag, ok := replacement.(map[string]interface{})
	if !ok {
		return true
	}
	if _, hasValue := bag["value"]; hasValue {
		return true
	}
	formula, _ := bag["formula"].(string)
	return isBareIdentifier(strings.TrimSpace(formula))
}

func propertyDirection(contract []componentCustomProperty, name string) string {
	for _, property := range contract {
		if strings.EqualFold(property.Name, name) {
			return strings.ToLower(strings.TrimSpace(property.Direction))
		}
	}
	return "input"
}

func isBareIdentifier(formula string) bool {
	if formula == "" {
		return false
	}
	for index, char := range formula {
		letter := (char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z')
		digit := char >= '0' && char <= '9'
		if index == 0 && !letter {
			return false
		}
		if index > 0 && !letter && !digit {
			return false
		}
	}
	return true
}

func componentReferenceName(formula string) string {
	trimmed := strings.TrimSpace(formula)
	if !strings.HasPrefix(trimmed, "Component.") {
		return ""
	}
	name := strings.TrimSpace(strings.TrimPrefix(trimmed, "Component."))
	if name == "" || strings.ContainsAny(name, " ()[]{},.+-*/") {
		return ""
	}
	return name
}

func lookupInstanceProperty(instance map[string]interface{}, name string) (interface{}, bool) {
	if instance == nil {
		return nil, false
	}
	if value, ok := instance[name]; ok {
		return value, true
	}
	for key, value := range instance {
		if strings.EqualFold(key, name) {
			return value, true
		}
	}
	return nil, false
}
