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

func TestExpandComponentInstancesSubstitutesInputs(t *testing.T) {
	instanceID := uuid.New()
	screenID := uuid.New()
	defID := uuid.New()
	defJSON, err := json.Marshal(componentDefinitionPayload{
		Properties: []componentCustomProperty{{
			Name:      "Items",
			Direction: "input",
			DataType:  "table",
		}},
		Controls: []componentSnapshotControl{{
			LocalID:     "gallery",
			ControlType: "gallery",
			Name:        "Gallery1",
			Width:       200,
			Height:      120,
			Properties: map[string]interface{}{
				"items": map[string]interface{}{"formula": "Component.Items"},
			},
		}},
	})
	if err != nil {
		t.Fatalf("marshal definition: %v", err)
	}
	flat := []contracts.RuntimeControl{{
		ID:          instanceID,
		ScreenID:    screenID,
		ControlType: "component",
		Name:        "CustomerList",
		Properties: map[string]interface{}{
			"definition_id": map[string]interface{}{"value": defID.String()},
			"Items":         map[string]interface{}{"formula": "Customers"},
		},
	}}
	expanded, err := expandComponentInstances(flat, []models.ComponentDefinition{{
		ID:             defID,
		Name:           "CustomerList",
		DefinitionJSON: datatypes.JSON(defJSON),
	}})
	if err != nil {
		t.Fatalf("expand: %v", err)
	}
	items, _ := expanded[1].Properties["items"].(map[string]interface{})
	if items["formula"] != "Customers" {
		t.Fatalf("expected substituted items formula, got %#v", items)
	}
	contract, _ := expanded[0].Properties["component_contract"].(map[string]interface{})
	if contract["value"] == nil {
		t.Fatalf("expected component contract on the instance")
	}
}

func TestExpandComponentInstancesKeepsEvaluatedTableFormulas(t *testing.T) {
	instanceID := uuid.New()
	screenID := uuid.New()
	defID := uuid.New()
	defJSON, err := json.Marshal(componentDefinitionPayload{
		Properties: []componentCustomProperty{{
			Name:      "Items",
			Direction: "input",
			DataType:  "table",
		}},
		Controls: []componentSnapshotControl{{
			LocalID:     "gallery",
			ControlType: "gallery",
			Name:        "Gallery1",
			Properties: map[string]interface{}{
				"items": map[string]interface{}{"formula": "Component.Items"},
			},
		}},
	})
	if err != nil {
		t.Fatalf("marshal definition: %v", err)
	}
	expanded, err := expandComponentInstances([]contracts.RuntimeControl{{
		ID:          instanceID,
		ScreenID:    screenID,
		ControlType: "component",
		Name:        "OpenCustomers",
		Properties: map[string]interface{}{
			"definition_id": map[string]interface{}{"value": defID.String()},
			"Items":         map[string]interface{}{"formula": `Filter(Customers, Status = "Open")`},
		},
	}}, []models.ComponentDefinition{{
		ID:             defID,
		Name:           "OpenCustomers",
		DefinitionJSON: datatypes.JSON(defJSON),
	}})
	if err != nil {
		t.Fatalf("expand: %v", err)
	}
	items, _ := expanded[1].Properties["items"].(map[string]interface{})
	if items["formula"] != "Component.Items" {
		t.Fatalf("expected the table formula to stay on the component scope, got %#v", items)
	}
}
