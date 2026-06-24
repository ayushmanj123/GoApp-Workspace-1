package services

import (
	"encoding/json"
	"testing"

	"github.com/goapps-platform/metadata-service/internal/api/contracts"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

func TestExpandComponentInstancesMaterializesChildren(t *testing.T) {
	instanceID := uuid.New()
	screenID := uuid.New()
	defID := uuid.New()
	defJSON, err := json.Marshal(componentDefinitionPayload{
		Controls: []componentSnapshotControl{
			{
				LocalID:     "root",
				ControlType: "label",
				Name:        "Title",
				X:           0,
				Y:           0,
				Width:       120,
				Height:      24,
				ZIndex:      1,
				Properties:  map[string]interface{}{"text": map[string]interface{}{"value": "Hello"}},
			},
		},
	})
	if err != nil {
		t.Fatalf("marshal definition: %v", err)
	}

	flat := []contracts.RuntimeControl{
		{
			ID:          instanceID,
			ScreenID:    screenID,
			ControlType: "component",
			Name:        "HeaderComponent",
			X:           40,
			Y:           60,
			Width:       200,
			Height:      80,
			ZIndex:      1,
			Properties: map[string]interface{}{
				"definition_id": map[string]interface{}{"value": defID.String()},
			},
		},
	}
	defs := []models.ComponentDefinition{
		{
			ID:             defID,
			Name:           "HeaderComponent",
			DefinitionJSON: datatypes.JSON(defJSON),
		},
	}

	expanded, err := expandComponentInstances(flat, defs)
	if err != nil {
		t.Fatalf("expandComponentInstances failed: %v", err)
	}
	if len(expanded) != 2 {
		t.Fatalf("expected 2 controls, got %d", len(expanded))
	}
	if expanded[1].ParentControlID == nil || *expanded[1].ParentControlID != instanceID {
		t.Fatalf("expected child parent to be instance")
	}
	if expanded[1].ControlType != "label" {
		t.Fatalf("expected label child, got %s", expanded[1].ControlType)
	}
}
