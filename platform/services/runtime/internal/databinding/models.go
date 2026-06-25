// Package databinding resolves control metadata into data queries for runtime controls.
package databinding

import (
	"errors"

	"github.com/google/uuid"
)

var (
	ErrDataSourceNotFound = errors.New("datasource not found")
	ErrInvalidFilter      = errors.New("invalid filter expression")
	ErrInvalidQuery       = errors.New("invalid query parameters")
)

// DataSourceKind identifies the backing provider for a datasource.
type DataSourceKind string

const (
	DataSourceKindEntity DataSourceKind = "entity"
)

// ControlBindingMetadata is control-level datasource configuration from metadata.
type ControlBindingMetadata struct {
	DataSource string `json:"dataSource"`
	Filter     string `json:"filter,omitempty"`
	Sort       string `json:"sort,omitempty"`
	Limit      int    `json:"limit,omitempty"`
}

// ResolvedBinding combines metadata defaults with a resolved entity reference.
type ResolvedBinding struct {
	Name       string
	Kind       DataSourceKind
	EntityID   uuid.UUID
	EntityName string
	Metadata   ControlBindingMetadata
}

// EqualsFilter is a simple field=value predicate supported in v1.
type EqualsFilter struct {
	Field string
	Value string
}

// QueryInput is the normalized runtime query passed to a DataSource.
type QueryInput struct {
	TenantID       uuid.UUID
	UserID         uuid.UUID
	EntityID       uuid.UUID
	Limit          int
	Offset         int
	Filters        []EqualsFilter
	OrderBy        string
	OrderDirection string
}

// QueryOverrides are optional API query parameters that override metadata defaults.
type QueryOverrides struct {
	Limit          int
	Offset         int
	Filter         string
	Sort           string
	OrderDirection string
}

// DataItem is a single row returned to runtime controls.
type DataItem map[string]interface{}

// QueryResult is the datasource query response.
type QueryResult struct {
	Items []DataItem `json:"items"`
	Count int64      `json:"count"`
}

// DataSourceKey identifies a resource within a datasource implementation.
type DataSourceKey struct {
	Kind     DataSourceKind
	EntityID uuid.UUID
}
