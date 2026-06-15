package api

import (
	"time"

	"github.com/google/uuid"
)

// Runtime DTOs for the runtime package

type RuntimeApplication struct {
	ID        uuid.UUID       `json:"id"`
	TenantID  uuid.UUID       `json:"tenant_id"`
	Name      string          `json:"name"`
	Status    string          `json:"status"`
	Screens   []RuntimeScreen `json:"screens"`
	CreatedOn time.Time       `json:"created_on"`
}

type RuntimeScreen struct {
	ID           uuid.UUID        `json:"id"`
	ApplicationID uuid.UUID       `json:"application_id"`
	Name         string           `json:"name"`
	DisplayOrder int              `json:"display_order"`
	LayoutType   string           `json:"layout_type"`
	Controls     []RuntimeControl `json:"controls"`
}

type RuntimeControl struct {
	ID              uuid.UUID               `json:"id"`
	ScreenID        uuid.UUID               `json:"screen_id"`
	ParentControlID *uuid.UUID              `json:"parent_control_id,omitempty"`
	ControlType     string                  `json:"control_type"`
	Name            string                  `json:"name"`
	X               float64                 `json:"x"`
	Y               float64                 `json:"y"`
	Width           float64                 `json:"width"`
	Height          float64                 `json:"height"`
	ZIndex          int                     `json:"z_index"`
	Properties      map[string]interface{}  `json:"properties,omitempty"`
	Formulas        []RuntimeFormula        `json:"formulas,omitempty"`
	Children        []RuntimeControl        `json:"children,omitempty"`
}

type RuntimeFormula struct {
	ID           uuid.UUID `json:"id"`
	ControlID    uuid.UUID `json:"control_id"`
	PropertyName string    `json:"property_name"`
	FormulaText  string    `json:"formula_text"`
	FormulaType  string    `json:"formula_type"`
}
