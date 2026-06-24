package services

import (
	"testing"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

func TestAssembleRuntimeApplicationRejectsInvalidPropertyJSON(t *testing.T) {
	appID := uuid.New()
	screenID := uuid.New()
	controlID := uuid.New()
	tenantID := uuid.New()
	_, err := assembleRuntimeApplication(
		&models.Application{ID: appID, TenantID: tenantID, Name: "A", Status: "draft"},
		[]models.Screen{{ID: screenID, ApplicationID: appID, Name: "S"}},
		[]models.Control{{ID: controlID, ScreenID: screenID, ControlType: "button", Name: "C"}},
		[]models.ControlProperty{{ID: uuid.New(), ControlID: controlID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{invalid`))}},
		nil,
		nil,
		nil,
		nil,
	)
	if err == nil {
		t.Fatalf("expected error for invalid property JSON")
	}
}

func TestAssembleRuntimeApplicationRejectsInvalidFormula(t *testing.T) {
	appID := uuid.New()
	screenID := uuid.New()
	controlID := uuid.New()
	tenantID := uuid.New()
	_, err := assembleRuntimeApplication(
		&models.Application{ID: appID, TenantID: tenantID, Name: "A", Status: "draft"},
		[]models.Screen{{ID: screenID, ApplicationID: appID, Name: "S"}},
		[]models.Control{{ID: controlID, ScreenID: screenID, ControlType: "button", Name: "C"}},
		nil,
		[]models.Formula{{ID: uuid.New(), ControlID: controlID, PropertyName: "text", FormulaText: "", FormulaType: "static"}},
		nil,
		nil,
		nil,
	)
	if err == nil {
		t.Fatalf("expected error for invalid formula")
	}
}
