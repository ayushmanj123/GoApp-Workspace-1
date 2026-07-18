// Package models contains the metadata-service GORM entities.
package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// AuditFields are present on every metadata table.
type AuditFields struct {
	CreatedOn  time.Time  `gorm:"column:created_on;not null;autoCreateTime"`
	CreatedBy  *uuid.UUID `gorm:"column:created_by;type:uuid"`
	ModifiedOn time.Time  `gorm:"column:modified_on;not null;autoUpdateTime"`
	ModifiedBy *uuid.UUID `gorm:"column:modified_by;type:uuid"`
}

// TenantScoped marks records owned by a tenant.
type TenantScoped struct {
	TenantID uuid.UUID `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
}

// Tenant is an isolated platform customer account.
type Tenant struct {
	ID     uuid.UUID `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name   string    `gorm:"column:name;not null;unique" json:"name"`
	Status string    `gorm:"column:status;not null" json:"status"`
	AuditFields
}

func (Tenant) TableName() string { return "tenants" }

// User maps an external identity provider user into a tenant.
type User struct {
	ID          uuid.UUID `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TenantID    uuid.UUID `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	ExternalID  string    `gorm:"column:external_id;not null" json:"external_id"`
	Email       string    `gorm:"column:email" json:"email"`
	DisplayName string    `gorm:"column:display_name;not null" json:"display_name"`
	AuditFields
}

func (User) TableName() string { return "users" }

type Application struct {
	ID               uuid.UUID      `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey;uniqueIndex:ux_app_tenant_id_id" json:"id"`
	TenantID         uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index;uniqueIndex:ux_app_tenant_id_id" json:"tenant_id"`
	Name             string         `gorm:"column:name;not null;index" json:"name"`
	Description      string         `gorm:"column:description;not null" json:"description"`
	Status           string         `gorm:"column:status;not null" json:"status"`
	OnStart          *string        `gorm:"column:on_start" json:"on_start,omitempty"`
	CurrentVersionID *uuid.UUID     `gorm:"column:current_version_id;type:uuid" json:"current_version_id"`
	DeletedAt        gorm.DeletedAt `gorm:"column:deleted_at;index" json:"deleted_at"`
	AuditFields
}

func (Application) TableName() string { return "applications" }

type Environment struct {
	ID               uuid.UUID  `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TenantID         uuid.UUID  `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	ApplicationID    uuid.UUID  `gorm:"column:application_id;type:uuid;not null;index" json:"application_id"`
	Name             string     `gorm:"column:name;not null" json:"name"`
	EnvironmentType  string     `gorm:"column:environment_type;not null" json:"environment_type"`
	CurrentVersionID *uuid.UUID `gorm:"column:current_version_id;type:uuid" json:"current_version_id"`
	AuditFields
}

func (Environment) TableName() string { return "environments" }

type ApplicationVersion struct {
	ID            uuid.UUID      `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey;uniqueIndex:ux_appver_tenant_id_id" json:"id"`
	TenantID      uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index;uniqueIndex:ux_appver_tenant_id_id" json:"tenant_id"`
	ApplicationID uuid.UUID      `gorm:"column:application_id;type:uuid;not null;index" json:"application_id"`
	Version       string         `gorm:"column:version;not null" json:"version"`
	Status        string         `gorm:"column:status;not null" json:"status"`
	Manifest      datatypes.JSON `gorm:"column:manifest;type:jsonb;not null" json:"manifest"`
	AuditFields
}

func (ApplicationVersion) TableName() string { return "application_versions" }

type Screen struct {
	ID            uuid.UUID      `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey;uniqueIndex:ux_screen_tenant_id_id" json:"id"`
	TenantID      uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index;uniqueIndex:ux_screen_tenant_id_id" json:"tenant_id"`
	ApplicationID uuid.UUID      `gorm:"column:application_id;type:uuid;not null;index" json:"application_id"`
	Name          string         `gorm:"column:name;not null" json:"name"`
	DisplayOrder  int            `gorm:"column:display_order;not null" json:"display_order"`
	LayoutType    string         `gorm:"column:layout_type;not null" json:"layout_type"`
	OnVisible     *string        `gorm:"column:on_visible" json:"on_visible,omitempty"`
	DeletedAt     gorm.DeletedAt `gorm:"column:deleted_at;index" json:"deleted_at"`
	AuditFields
}

func (Screen) TableName() string { return "screens" }

type Control struct {
	ID              uuid.UUID      `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey;uniqueIndex:ux_control_tenant_id_id" json:"id"`
	TenantID        uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index;uniqueIndex:ux_control_tenant_id_id" json:"tenant_id"`
	ScreenID        uuid.UUID      `gorm:"column:screen_id;type:uuid;not null;index" json:"screen_id"`
	ParentControlID *uuid.UUID     `gorm:"column:parent_control_id;type:uuid;index" json:"parent_control_id"`
	ControlType     string         `gorm:"column:control_type;not null" json:"control_type"`
	Name            string         `gorm:"column:name;not null" json:"name"`
	X               float64        `gorm:"column:x;not null" json:"x"`
	Y               float64        `gorm:"column:y;not null" json:"y"`
	Width           float64        `gorm:"column:width;not null" json:"width"`
	Height          float64        `gorm:"column:height;not null" json:"height"`
	ZIndex          int            `gorm:"column:z_index;not null" json:"z_index"`
	DeletedAt       gorm.DeletedAt `gorm:"column:deleted_at;index" json:"deleted_at"`
	AuditFields
}

func (Control) TableName() string { return "controls" }

type ControlProperty struct {
	ID            uuid.UUID      `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TenantID      uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	ControlID     uuid.UUID      `gorm:"column:control_id;type:uuid;not null;index" json:"control_id"`
	PropertyName  string         `gorm:"column:property_name;not null" json:"property_name"`
	PropertyValue datatypes.JSON `gorm:"column:property_value;type:jsonb;not null" json:"property_value"`
	AuditFields
}

func (ControlProperty) TableName() string { return "control_properties" }

type Formula struct {
	ID           uuid.UUID `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TenantID     uuid.UUID `gorm:"column:tenant_id;type:uuid;not null;index;uniqueIndex:ux_formula_tenant_id_id" json:"tenant_id"`
	ControlID    uuid.UUID `gorm:"column:control_id;type:uuid;not null;index" json:"control_id"`
	PropertyName string    `gorm:"column:property_name;not null" json:"property_name"`
	FormulaText  string    `gorm:"column:formula_text;not null" json:"formula_text"`
	FormulaType  string    `gorm:"column:formula_type;not null" json:"formula_type"`
	AuditFields
}

func (Formula) TableName() string { return "formulas" }

type Event struct {
	ID        uuid.UUID `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TenantID  uuid.UUID `gorm:"column:tenant_id;type:uuid;not null;index;uniqueIndex:ux_event_tenant_id_id" json:"tenant_id"`
	ControlID uuid.UUID `gorm:"column:control_id;type:uuid;not null;index" json:"control_id"`
	EventName string    `gorm:"column:event_name;not null" json:"event_name"`
	FormulaID uuid.UUID `gorm:"column:formula_id;type:uuid;not null" json:"formula_id"`
	AuditFields
}

func (Event) TableName() string { return "events" }

type Variable struct {
	ID            uuid.UUID `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TenantID      uuid.UUID `gorm:"column:tenant_id;type:uuid;not null;index;uniqueIndex:ux_controlprop_tenant_id_id" json:"tenant_id"`
	ApplicationID uuid.UUID `gorm:"column:application_id;type:uuid;not null;index" json:"application_id"`
	Name          string    `gorm:"column:name;not null" json:"name"`
	VariableType  string    `gorm:"column:variable_type;not null" json:"variable_type"`
	AuditFields
}

func (Variable) TableName() string { return "variables" }

type Collection struct {
	ID               uuid.UUID      `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TenantID         uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	ApplicationID    uuid.UUID      `gorm:"column:application_id;type:uuid;not null;index" json:"application_id"`
	Name             string         `gorm:"column:name;not null" json:"name"`
	SchemaDefinition datatypes.JSON `gorm:"column:schema_definition;type:jsonb;not null" json:"schema_definition"`
	AuditFields
}

func (Collection) TableName() string { return "collections" }

type Connector struct {
	ID                 uuid.UUID      `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey;uniqueIndex:ux_connector_tenant_id_id" json:"id"`
	TenantID           uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index;uniqueIndex:ux_connector_tenant_id_id" json:"tenant_id"`
	ApplicationID      uuid.UUID      `gorm:"column:application_id;type:uuid;not null;index" json:"application_id"`
	ConnectorType      string         `gorm:"column:connector_type;not null" json:"connector_type"`
	Name               string         `gorm:"column:name;not null" json:"name"`
	AuthenticationType string         `gorm:"column:authentication_type;not null" json:"authentication_type"`
	// BaseURL and AuthConfig are connector-type specific.
	// REST: {"type":"none"} or {"type":"header","header_name":"X","secret_id":"<uuid>"}.
	// SQL:  {"type":"connection_string","secret_id":"<uuid>","table":"public.orders","primary_key":"id"}.
	// Never persist header_value or connection_string plaintext after Phase 7.5/7.6.
	BaseURL    string         `gorm:"column:base_url;not null;default:''" json:"base_url"`
	AuthConfig datatypes.JSON `gorm:"column:auth_config;type:jsonb;not null;default:'{}'" json:"auth_config"`
	DeletedAt  gorm.DeletedAt `gorm:"column:deleted_at;index" json:"deleted_at"`
	AuditFields
}

func (Connector) TableName() string { return "connectors" }

// Secret stores an encrypted value (AES-GCM) for connector auth and similar uses.
// Plaintext is never returned on API responses.
type Secret struct {
	ID            uuid.UUID      `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey;uniqueIndex:ux_secret_tenant_id_id" json:"id"`
	TenantID      uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index;uniqueIndex:ux_secret_tenant_id_id" json:"tenant_id"`
	ApplicationID *uuid.UUID     `gorm:"column:application_id;type:uuid;index" json:"application_id,omitempty"`
	Name          string         `gorm:"column:name;not null" json:"name"`
	Ciphertext    []byte         `gorm:"column:ciphertext;type:bytea;not null" json:"-"`
	Nonce         []byte         `gorm:"column:nonce;type:bytea;not null" json:"-"`
	DeletedAt     gorm.DeletedAt `gorm:"column:deleted_at;index" json:"deleted_at"`
	AuditFields
}

func (Secret) TableName() string { return "secrets" }

type ConnectorAction struct {
	ID          uuid.UUID `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TenantID    uuid.UUID `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	ConnectorID uuid.UUID `gorm:"column:connector_id;type:uuid;not null;index" json:"connector_id"`
	ActionName  string    `gorm:"column:action_name;not null" json:"action_name"`
	HTTPMethod  string    `gorm:"column:http_method;not null" json:"http_method"`
	Endpoint    string    `gorm:"column:endpoint;not null" json:"endpoint"`
	AuditFields
}

func (ConnectorAction) TableName() string { return "connector_actions" }

type Permission struct {
	ID             uuid.UUID `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TenantID       uuid.UUID `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	ApplicationID  uuid.UUID `gorm:"column:application_id;type:uuid;not null;index" json:"application_id"`
	RoleName       string    `gorm:"column:role_name;not null" json:"role_name"`
	PermissionName string    `gorm:"column:permission_name;not null" json:"permission_name"`
	AuditFields
}

func (Permission) TableName() string { return "permissions" }

type AuditLog struct {
	ID           uuid.UUID  `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TenantID     uuid.UUID  `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	UserID       *uuid.UUID `gorm:"column:user_id;type:uuid" json:"user_id"`
	Action       string     `gorm:"column:action;not null" json:"action"`
	ResourceType string     `gorm:"column:resource_type;not null" json:"resource_type"`
	ResourceID   uuid.UUID  `gorm:"column:resource_id;type:uuid;not null" json:"resource_id"`
	AuditFields
}

func (AuditLog) TableName() string { return "audit_logs" }

type Package struct {
	ID                   uuid.UUID `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TenantID             uuid.UUID `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	ApplicationVersionID uuid.UUID `gorm:"column:application_version_id;type:uuid;not null;index" json:"application_version_id"`
	PackageURL           string    `gorm:"column:package_url;not null" json:"package_url"`
	PackageHash          string    `gorm:"column:package_hash;not null;unique" json:"package_hash"`
	AuditFields
}

func (Package) TableName() string { return "packages" }

type ApplicationSnapshot struct {
	ID                   uuid.UUID      `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TenantID             uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	ApplicationVersionID uuid.UUID      `gorm:"column:application_version_id;type:uuid;not null;index" json:"application_version_id"`
	SnapshotJSON         datatypes.JSON `gorm:"column:snapshot_json;type:jsonb;not null" json:"snapshot_json"`
	CreatedOn            time.Time      `gorm:"column:created_on;not null;autoCreateTime" json:"created_on"`
}

func (ApplicationSnapshot) TableName() string { return "application_snapshots" }

type ComponentDefinition struct {
	ID             uuid.UUID      `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TenantID       uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	ApplicationID  uuid.UUID      `gorm:"column:application_id;type:uuid;not null;index" json:"application_id"`
	Name           string         `gorm:"column:name;not null" json:"name"`
	DefinitionJSON datatypes.JSON `gorm:"column:definition_json;type:jsonb;not null" json:"definition_json"`
	DeletedAt      gorm.DeletedAt `gorm:"column:deleted_at;index" json:"deleted_at"`
	AuditFields
}

func (ComponentDefinition) TableName() string { return "component_definitions" }

type Entity struct {
	ID            uuid.UUID      `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TenantID      uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	ApplicationID uuid.UUID      `gorm:"column:application_id;type:uuid;not null;index" json:"application_id"`
	Name          string         `gorm:"column:name;not null" json:"name"`
	DisplayName   string         `gorm:"column:display_name;not null" json:"display_name"`
	DeletedAt     gorm.DeletedAt `gorm:"column:deleted_at;index" json:"deleted_at"`
	AuditFields
}

func (Entity) TableName() string { return "entities" }

type EntityField struct {
	ID          uuid.UUID      `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TenantID    uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	EntityID    uuid.UUID      `gorm:"column:entity_id;type:uuid;not null;index" json:"entity_id"`
	Name        string         `gorm:"column:name;not null" json:"name"`
	DisplayName string         `gorm:"column:display_name;not null" json:"display_name"`
	FieldType   string         `gorm:"column:field_type;not null" json:"field_type"`
	IsRequired  bool           `gorm:"column:is_required;not null;default:false" json:"is_required"`
	DeletedAt   gorm.DeletedAt `gorm:"column:deleted_at;index" json:"deleted_at"`
	AuditFields
}

func (EntityField) TableName() string { return "entity_fields" }

// SolutionPackage is an ALM package that references environment components.
// Distinct from Package (publish artifact URL/hash).
type SolutionPackage struct {
	ID          uuid.UUID      `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TenantID    uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	Name        string         `gorm:"column:name;not null" json:"name"`
	DisplayName string         `gorm:"column:display_name;not null" json:"display_name"`
	Description string         `gorm:"column:description;not null;default:''" json:"description"`
	Version     string         `gorm:"column:version;not null;default:1.0.0" json:"version"`
	Managed     bool           `gorm:"column:managed;not null;default:false" json:"managed"`
	IsMaster    bool           `gorm:"column:is_master;not null;default:false" json:"is_master"`
	Status      string         `gorm:"column:status;not null;default:draft" json:"status"`
	DeletedAt   gorm.DeletedAt `gorm:"column:deleted_at;index" json:"deleted_at"`
	AuditFields
}

func (SolutionPackage) TableName() string { return "solution_packages" }

// SolutionPackageComponent is a reference from a package to an existing component.
type SolutionPackageComponent struct {
	ID            uuid.UUID  `gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TenantID      uuid.UUID  `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	PackageID     uuid.UUID  `gorm:"column:package_id;type:uuid;not null;index" json:"package_id"`
	ComponentType string     `gorm:"column:component_type;not null" json:"component_type"`
	ComponentID   uuid.UUID  `gorm:"column:component_id;type:uuid;not null" json:"component_id"`
	CreatedOn     time.Time  `gorm:"column:created_on;not null;autoCreateTime" json:"created_on"`
	CreatedBy     *uuid.UUID `gorm:"column:created_by;type:uuid" json:"created_by,omitempty"`
}

func (SolutionPackageComponent) TableName() string { return "solution_package_components" }
