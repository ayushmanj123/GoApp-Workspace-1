package contracts

import (
	"encoding/json"
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
	Name            string  `json:"name" validate:"required,min=1,max=200"`
	DisplayName     string  `json:"display_name" validate:"required,min=1,max=200"`
	FieldType       string  `json:"field_type" validate:"required,oneof=text number boolean date lookup"`
	RelatedEntityID *string `json:"related_entity_id" validate:"omitempty,uuid4"`
}

type UpdateEntityFieldRequest struct {
	Name        *string `json:"name" validate:"omitempty,min=1,max=200"`
	DisplayName *string `json:"display_name" validate:"omitempty,min=1,max=200"`
	FieldType   *string `json:"field_type" validate:"omitempty,oneof=text number boolean date lookup"`
	// RelatedEntityID: a valid UUID sets/changes the relationship target; an
	// explicit empty string clears it. Omit the field to leave it unchanged.
	RelatedEntityID *string `json:"related_entity_id" validate:"omitempty"`
}

// Connector DTOs
type CreateConnectorRequest struct {
	Name               string          `json:"name" validate:"required,min=1,max=200"`
	ConnectorType      string          `json:"connector_type" validate:"required,oneof=rest sql storage"`
	AuthenticationType string          `json:"authentication_type" validate:"required,oneof=none header connection_string oauth_client_credentials oauth_authorization_code s3"`
	BaseURL            string          `json:"base_url" validate:"omitempty,max=2000"`
	AuthConfig         json.RawMessage `json:"auth_config" validate:"omitempty"`
}

type UpdateConnectorRequest struct {
	Name               *string         `json:"name" validate:"omitempty,min=1,max=200"`
	AuthenticationType *string         `json:"authentication_type" validate:"omitempty,oneof=none header connection_string oauth_client_credentials oauth_authorization_code s3"`
	BaseURL            *string         `json:"base_url" validate:"omitempty,max=2000"`
	AuthConfig         json.RawMessage `json:"auth_config" validate:"omitempty"`
}

type CreateConnectorActionRequest struct {
	ActionName string `json:"action_name" validate:"required,min=1,max=200"`
	HTTPMethod string `json:"http_method" validate:"required,oneof=GET POST PUT PATCH DELETE HEAD OPTIONS"`
	Endpoint   string `json:"endpoint" validate:"required,max=2000"`
}

type UpdateConnectorActionRequest struct {
	ActionName *string `json:"action_name" validate:"omitempty,min=1,max=200"`
	HTTPMethod *string `json:"http_method" validate:"omitempty,oneof=GET POST PUT PATCH DELETE HEAD OPTIONS"`
	Endpoint   *string `json:"endpoint" validate:"omitempty,max=2000"`
}

// Workflow DTOs (Phase 7.23)
type CreateWorkflowRequest struct {
	Name       string          `json:"name" validate:"required,min=1,max=200"`
	Definition json.RawMessage `json:"definition" validate:"required"`
}

type UpdateWorkflowRequest struct {
	Name       *string         `json:"name" validate:"omitempty,min=1,max=200"`
	Definition json.RawMessage `json:"definition" validate:"omitempty"`
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
	ID         uuid.UUID          `json:"id"`
	TenantID   uuid.UUID          `json:"tenant_id"`
	Name       string             `json:"name"`
	Status     string             `json:"status"`
	OnStart    *string            `json:"on_start,omitempty"`
	Screens    []RuntimeScreen    `json:"screens"`
	Entities   []RuntimeEntity    `json:"entities,omitempty"`
	Connectors []RuntimeConnector `json:"connectors,omitempty"`
	CreatedOn  time.Time          `json:"created_on"`
}

type RuntimeEntity struct {
	Name   string              `json:"name"`
	Fields []RuntimeEntityField `json:"fields"`
}

type RuntimeEntityField struct {
	Name      string `json:"name"`
	FieldType string `json:"field_type"`
}

// RuntimeConnector is the frozen (publish-time) view of a connector.
// AuthConfig is sanitized: it carries secret_id references only, never
// plaintext secrets (header_value, client_secret, connection_string,
// secret_access_key are always stripped before this is assembled).
type RuntimeConnector struct {
	ID                 uuid.UUID                `json:"id"`
	Name               string                   `json:"name"`
	ConnectorType      string                   `json:"connector_type"`
	AuthenticationType string                   `json:"authentication_type"`
	BaseURL            string                   `json:"base_url,omitempty"`
	AuthConfig         json.RawMessage          `json:"auth_config,omitempty"`
	Actions            []RuntimeConnectorAction `json:"actions,omitempty"`
}

type RuntimeConnectorAction struct {
	ActionName string `json:"action_name"`
	HTTPMethod string `json:"http_method"`
	Endpoint   string `json:"endpoint"`
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

// Publish ALM DTOs (Phase 8.0 — unpublish / rollback / deprecate)

type UnpublishResult struct {
	ApplicationID uuid.UUID `json:"application_id"`
	Status        string    `json:"status"`
}

type RollbackResult struct {
	ApplicationID uuid.UUID `json:"application_id"`
	VersionID     uuid.UUID `json:"version_id"`
	Version       string    `json:"version"`
	Status        string    `json:"status"`
}

type DeprecateResult struct {
	ApplicationID     uuid.UUID `json:"application_id"`
	VersionID         uuid.UUID `json:"version_id"`
	Version           string    `json:"version"`
	Status            string    `json:"status"`
	ApplicationStatus string    `json:"application_status"`
	WasCurrent        bool      `json:"was_current"`
}

// Environment DTOs

type CreateEnvironmentRequest struct {
	Name            string `json:"name" validate:"required,min=1,max=200"`
	EnvironmentType string `json:"environment_type" validate:"required,oneof=development test production"`
}

type UpdateEnvironmentRequest struct {
	Name            *string `json:"name" validate:"omitempty,min=1,max=200"`
	EnvironmentType *string `json:"environment_type" validate:"omitempty,oneof=development test production"`
}

type PromoteEnvironmentRequest struct {
	VersionID string `json:"version_id" validate:"required,uuid4"`
}

type UpsertEnvironmentSecretOverrideRequest struct {
	ConnectorID string `json:"connector_id" validate:"required,uuid4"`
	Value       string `json:"value" validate:"required,min=1"`
}

type EnvironmentDTO struct {
	ID               uuid.UUID  `json:"id"`
	TenantID         uuid.UUID  `json:"tenant_id"`
	ApplicationID    uuid.UUID  `json:"application_id"`
	Name             string     `json:"name"`
	EnvironmentType  string     `json:"environment_type"`
	CurrentVersionID *uuid.UUID `json:"current_version_id,omitempty"`
	CurrentVersion   *string    `json:"current_version,omitempty"`
	CreatedOn        time.Time  `json:"created_on"`
	CreatedBy        *uuid.UUID `json:"created_by,omitempty"`
	ModifiedOn       time.Time  `json:"modified_on"`
	ModifiedBy       *uuid.UUID `json:"modified_by,omitempty"`
}

// Audit event DTOs

type CreateAuditEventRequest struct {
	Action       string `json:"action" validate:"required,min=1,max=100"`
	ResourceType string `json:"resource_type" validate:"required,min=1,max=100"`
	ResourceID   string `json:"resource_id" validate:"required,uuid4"`
	UserID       *string `json:"user_id" validate:"omitempty,uuid4"`
}

type AuditEventDTO struct {
	ID           uuid.UUID  `json:"id"`
	TenantID     uuid.UUID  `json:"tenant_id"`
	UserID       *uuid.UUID `json:"user_id,omitempty"`
	Action       string     `json:"action"`
	ResourceType string     `json:"resource_type"`
	ResourceID   uuid.UUID  `json:"resource_id"`
	CreatedOn    time.Time  `json:"created_on"`
}

// Solution package DTOs

type CreateSolutionPackageRequest struct {
	Name        string `json:"name" validate:"required,min=1,max=200"`
	DisplayName string `json:"display_name" validate:"required,min=1,max=200"`
	Description string `json:"description" validate:"omitempty,max=2000"`
}

type UpdateSolutionPackageRequest struct {
	Name        *string `json:"name" validate:"omitempty,min=1,max=200"`
	DisplayName *string `json:"display_name" validate:"omitempty,min=1,max=200"`
	Description *string `json:"description" validate:"omitempty,max=2000"`
	Version     *string `json:"version" validate:"omitempty,min=1,max=50"`
}

type AddPackageComponentRequest struct {
	ComponentType string `json:"component_type" validate:"required,oneof=app table"`
	ComponentID   string `json:"component_id" validate:"required,uuid4"`
}

type SolutionPackageDTO struct {
	ID             uuid.UUID  `json:"id"`
	TenantID       uuid.UUID  `json:"tenant_id"`
	Name           string     `json:"name"`
	DisplayName    string     `json:"display_name"`
	Description    string     `json:"description"`
	Version        string     `json:"version"`
	Managed        bool       `json:"managed"`
	IsMaster       bool       `json:"is_master"`
	Status         string     `json:"status"`
	ComponentCount int64      `json:"component_count"`
	CreatedOn      time.Time  `json:"created_on"`
	CreatedBy      *uuid.UUID `json:"created_by,omitempty"`
	ModifiedOn     time.Time  `json:"modified_on"`
	ModifiedBy     *uuid.UUID `json:"modified_by,omitempty"`
}

type PackageComponentDTO struct {
	ID            uuid.UUID  `json:"id"`
	PackageID     uuid.UUID  `json:"package_id"`
	ComponentType string     `json:"component_type"`
	ComponentID   uuid.UUID  `json:"component_id"`
	Name          string     `json:"name"`
	DisplayName   string     `json:"display_name"`
	AddedOn       time.Time  `json:"added_on"`
	AddedBy       *uuid.UUID `json:"added_by,omitempty"`
}
