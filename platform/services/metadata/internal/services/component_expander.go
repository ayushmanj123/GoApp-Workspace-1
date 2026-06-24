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

type componentDefinitionPayload struct {
	Controls []componentSnapshotControl `json:"controls"`
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
		children, err := materializeComponentChildren(control, payload)
		if err != nil {
			return nil, err
		}
		expanded = append(expanded, children...)
	}
	return expanded, nil
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
			Properties:      snapshot.Properties,
		})
	}
	return out, nil
}
