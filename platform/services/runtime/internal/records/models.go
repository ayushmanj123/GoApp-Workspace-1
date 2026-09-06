// Package records implements generic entity record CRUD for the runtime service.
package records

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// Sentinel errors returned by the record service and repository.
var (
	ErrNotFound        = errors.New("record not found")
	ErrEntityNotFound  = errors.New("entity not found")
	ErrVersionConflict = errors.New("version conflict")
	ErrValidation      = errors.New("validation failed")
)

// ValidationError carries field-level validation failures.
type ValidationError struct {
	Message string
	Field   string
}

func (e *ValidationError) Error() string {
	if e.Field != "" {
		return e.Field + ": " + e.Message
	}
	return e.Message
}

func (e *ValidationError) Unwrap() error {
	return ErrValidation
}

// EntityRecord is a persisted row in entity_records.
type EntityRecord struct {
	ID         uuid.UUID
	TenantID   uuid.UUID
	EntityID   uuid.UUID
	Data       map[string]interface{}
	Version    int
	CreatedOn  time.Time
	CreatedBy  *uuid.UUID
	ModifiedOn time.Time
	ModifiedBy *uuid.UUID
	DeletedOn  *time.Time
	DeletedBy  *uuid.UUID
}

// FieldSchema describes a single field from entity metadata.
type FieldSchema struct {
	Name       string
	FieldType  string
	IsRequired bool
	IsUnique   bool
	Options    []string
	Config     map[string]interface{}
}

// EntityKeySchema describes an alternate unique key.
type EntityKeySchema struct {
	Name       string
	FieldNames []string
}

// EntitySchema is the metadata snapshot used for record validation.
type EntitySchema struct {
	EntityID uuid.UUID
	TenantID uuid.UUID
	Name     string
	Fields   []FieldSchema
	Keys     []EntityKeySchema
}

// ListOptions controls pagination, ordering, and optional filter pushdown.
type ListOptions struct {
	Limit          int
	Offset         int
	OrderBy        string
	OrderDirection string
	FilterExpr     FilterExpr
}
