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
	OnStart          *string `json:"on_start" validate:"omitempty"`
}

// Screen DTOs
type CreateScreenRequest struct {
	Name         string `json:"name" validate:"required"`
	DisplayOrder int    `json:"display_order" validate:"required"`
	LayoutType   string `json:"layout_type" validate:"required"`
}

type UpdateScreenRequest struct {
	Name         *string `json:"name" validate:"omitempty,min=1,max=200"`
	DisplayOrder *int    `json:"display_order" validate:"omitempty"`
	LayoutType   *string `json:"layout_type" validate:"omitempty"`
	OnVisible    *string `json:"on_visible" validate:"omitempty"`
}

// Control DTOs
type CreateControlRequest struct {
	Name            string  `json:"name" validate:"required"`
	ControlType     string  `json:"control_type" validate:"required"`
	X               float64 `json:"x" validate:"gte=0"`
	Y               float64 `json:"y" validate:"gte=0"`
	Width           float64 `json:"width" validate:"gt=0"`
	Height          float64 `json:"height" validate:"gt=0"`
	ZIndex          int     `json:"z_index" validate:"gte=0"`
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

// Component definition DTOs
type CreateComponentDefinitionRequest struct {
	Name       string                 `json:"name" validate:"required,min=1,max=200"`
	Definition map[string]interface{} `json:"definition" validate:"required"`
}

// Entity DTOs
type CreateEntityRequest struct {
	Name        string `json:"name" validate:"required,min=1,max=200"`
	DisplayName string `json:"display_name" validate:"required,min=1,max=200"`
}

type UpdateEntityRequest struct {
	Name        *string `json:"name" validate:"omitempty,min=1,max=200"`
	DisplayName *string `json:"display_name" validate:"omitempty,min=1,max=200"`
}

type CreateEntityFieldRequest struct {
	Name        string `json:"name" validate:"required,min=1,max=200"`
	DisplayName string `json:"display_name" validate:"required,min=1,max=200"`
	FieldType   string `json:"field_type" validate:"required,oneof=text number boolean date"`
}

type UpdateEntityFieldRequest struct {
	Name        *string `json:"name" validate:"omitempty,min=1,max=200"`
	DisplayName *string `json:"display_name" validate:"omitempty,min=1,max=200"`
	FieldType   *string `json:"field_type" validate:"omitempty,oneof=text number boolean date"`
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
	ID        uuid.UUID        `json:"id"`
	TenantID  uuid.UUID        `json:"tenant_id"`
	Name      string           `json:"name"`
	Status    string           `json:"status"`
	OnStart   *string          `json:"on_start,omitempty"`
	Screens   []RuntimeScreen  `json:"screens"`
	Entities  []RuntimeEntity  `json:"entities,omitempty"`
	CreatedOn time.Time        `json:"created_on"`
}

type RuntimeEntity struct {
	Name   string              `json:"name"`
	Fields []RuntimeEntityField `json:"fields"`
}

type RuntimeEntityField struct {
	Name      string `json:"name"`
	FieldType string `json:"field_type"`
}

type RuntimeScreen struct {
	ID            uuid.UUID        `json:"id"`
	ApplicationID uuid.UUID        `json:"application_id"`
	Name          string           `json:"name"`
	DisplayOrder  int              `json:"display_order"`
	LayoutType    string           `json:"layout_type"`
	OnVisible     *string          `json:"on_visible,omitempty"`
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

// Publish DTOs

type PublishApplicationRequest struct {
	Version *string `json:"version" validate:"omitempty,max=50"`
	Notes   *string `json:"notes" validate:"omitempty,max=500"`
}

type PublishResult struct {
	ApplicationID uuid.UUID `json:"application_id"`
	VersionID     uuid.UUID `json:"version_id"`
	Version       string    `json:"version"`
	Status        string    `json:"status"`
	SnapshotID    uuid.UUID `json:"snapshot_id"`
	PublishedAt   time.Time `json:"published_at"`
}

type ApplicationVersionSummary struct {
	ID        uuid.UUID `json:"id"`
	Version   string    `json:"version"`
	Status    string    `json:"status"`
	CreatedOn time.Time `json:"created_on"`
}

type ApplicationVersionDetail struct {
	ApplicationVersionSummary
	ApplicationID uuid.UUID `json:"application_id"`
	Manifest      any       `json:"manifest,omitempty"`
	SnapshotSize  int       `json:"snapshot_size"`
}
