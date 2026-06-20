package contracts

import (
	"time"

	"github.com/google/uuid"
)

// API standard response model
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// Application DTOs
type CreateApplicationRequest struct {
	Name        string `json:"name" validate:"required,min=1,max=200"`
	Description string `json:"description" validate:"required"`
}

type UpdateApplicationRequest struct {
	Name             *string `json:"name" validate:"omitempty,min=1,max=200"`
	Description      *string `json:"description" validate:"omitempty"`
	Status           *string `json:"status" validate:"omitempty,oneof=draft published archived"`
	CurrentVersionID *string `json:"current_version_id" validate:"omitempty,uuid4"`
}

// Screen DTOs
type CreateScreenRequest struct {
	Name         string `json:"name" validate:"required"`
	DisplayOrder int    `json:"display_order" validate:"required"`
	LayoutType   string `json:"layout_type" validate:"required"`
}

// Control DTOs
type CreateControlRequest struct {
	Name            string  `json:"name" validate:"required"`
	ControlType     string  `json:"control_type" validate:"required"`
	X               float64 `json:"x" validate:"required"`
	Y               float64 `json:"y" validate:"required"`
	Width           float64 `json:"width" validate:"required"`
	Height          float64 `json:"height" validate:"required"`
	ZIndex          int     `json:"z_index" validate:"required"`
	ParentControlID *string `json:"parent_control_id" validate:"omitempty,uuid4"`
}

// Property DTOs
type UpdatePropertiesRequest struct {
	Properties map[string]interface{} `json:"properties" validate:"required"`
}

// Formula DTOs
type CreateFormulaRequest struct {
	PropertyName string `json:"property_name" validate:"required"`
	FormulaText  string `json:"formula_text" validate:"required"`
	FormulaType  string `json:"formula_type" validate:"required"`
}

type UpdateFormulaRequest struct {
	PropertyName *string `json:"property_name" validate:"omitempty"`
	FormulaText  *string `json:"formula_text" validate:"omitempty"`
	FormulaType  *string `json:"formula_type" validate:"omitempty"`
}

// Pagination
type ListOptions struct {
	Limit  int `query:"limit"`
	Offset int `query:"offset"`
}

type PagedResponse struct {
	Items interface{} `json:"items"`
	Total int64       `json:"total"`
}

// helper for IDs
func ParseUUIDPtr(s *string) *uuid.UUID {
	if s == nil {
		return nil
	}
	u, err := uuid.Parse(*s)
	if err != nil {
		return nil
	}
	return &u
}

// timestamp
func NowUTC() time.Time { return time.Now().UTC() }

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
	ID            uuid.UUID        `json:"id"`
	ApplicationID uuid.UUID        `json:"application_id"`
	Name          string           `json:"name"`
	DisplayOrder  int              `json:"display_order"`
	LayoutType    string           `json:"layout_type"`
	Controls      []RuntimeControl `json:"controls"`
}

type RuntimeControl struct {
	ID              uuid.UUID              `json:"id"`
	ScreenID        uuid.UUID              `json:"screen_id"`
	ParentControlID *uuid.UUID             `json:"parent_control_id,omitempty"`
	ControlType     string                 `json:"control_type"`
	Name            string                 `json:"name"`
	X               float64                `json:"x"`
	Y               float64                `json:"y"`
	Width           float64                `json:"width"`
	Height          float64                `json:"height"`
	ZIndex          int                    `json:"z_index"`
	Properties      map[string]interface{} `json:"properties,omitempty"`
	Formulas        []RuntimeFormula       `json:"formulas,omitempty"`
	Children        []RuntimeControl       `json:"children,omitempty"`
}

type RuntimeFormula struct {
	ID           uuid.UUID `json:"id"`
	ControlID    uuid.UUID `json:"control_id"`
	PropertyName string    `json:"property_name"`
	FormulaText  string    `json:"formula_text"`
	FormulaType  string    `json:"formula_type"`
}
