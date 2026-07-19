package records

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ValidateCreateData validates record data for insert using entity schema metadata.
func ValidateCreateData(schema *EntitySchema, data map[string]interface{}) error {
	if schema == nil {
		return ErrEntityNotFound
	}
	if data == nil {
		data = map[string]interface{}{}
	}
	return validateData(schema, data, true)
}

// ValidateUpdateData validates a partial update payload against entity schema metadata.
func ValidateUpdateData(schema *EntitySchema, data map[string]interface{}) error {
	if schema == nil {
		return ErrEntityNotFound
	}
	if data == nil || len(data) == 0 {
		return &ValidationError{Message: "data is required"}
	}
	return validateData(schema, data, false)
}

func validateData(schema *EntitySchema, data map[string]interface{}, isCreate bool) error {
	fieldByName := make(map[string]FieldSchema, len(schema.Fields))
	for _, field := range schema.Fields {
		fieldByName[field.Name] = field
	}

	for key := range data {
		if _, ok := fieldByName[key]; !ok {
			return &ValidationError{
				Field:   key,
				Message: "unknown field",
			}
		}
	}

	if isCreate {
		for _, field := range schema.Fields {
			if !field.IsRequired {
				continue
			}
			value, ok := data[field.Name]
			if !ok || isEmptyValue(value) {
				return &ValidationError{
					Field:   field.Name,
					Message: "required field missing",
				}
			}
		}
	}

	for key, value := range data {
		field := fieldByName[key]
		if err := validateFieldValue(field, value); err != nil {
			return err
		}
	}

	return nil
}

func validateFieldValue(field FieldSchema, value interface{}) error {
	if value == nil {
		if field.IsRequired {
			return &ValidationError{
				Field:   field.Name,
				Message: "required field missing",
			}
		}
		return nil
	}

	switch field.FieldType {
	case "text":
		if _, ok := value.(string); !ok {
			return typeError(field.Name, "text")
		}
	case "number":
		switch value.(type) {
		case float64, float32, int, int32, int64:
		default:
			return typeError(field.Name, "number")
		}
	case "boolean":
		if _, ok := value.(bool); !ok {
			return typeError(field.Name, "boolean")
		}
	case "date":
		str, ok := value.(string)
		if !ok {
			return typeError(field.Name, "date")
		}
		if _, err := time.Parse("2006-01-02", str); err != nil {
			return &ValidationError{
				Field:   field.Name,
				Message: "invalid date format, expected YYYY-MM-DD",
			}
		}
	case "lookup":
		str, ok := value.(string)
		if !ok {
			return typeError(field.Name, "lookup")
		}
		if _, err := uuid.Parse(str); err != nil {
			return &ValidationError{
				Field:   field.Name,
				Message: "invalid lookup value, expected a related record id",
			}
		}
	default:
		return &ValidationError{
			Field:   field.Name,
			Message: fmt.Sprintf("unsupported field type %q", field.FieldType),
		}
	}
	return nil
}

func typeError(fieldName, expected string) *ValidationError {
	return &ValidationError{
		Field:   fieldName,
		Message: fmt.Sprintf("expected %s value", expected),
	}
}

func isEmptyValue(value interface{}) bool {
	if value == nil {
		return true
	}
	if str, ok := value.(string); ok {
		return strings.TrimSpace(str) == ""
	}
	return false
}

// NormalizeListOptions applies defaults and validates list query parameters.
func NormalizeListOptions(opts ListOptions, schema *EntitySchema) (ListOptions, error) {
	if opts.Limit <= 0 {
		opts.Limit = 50
	}
	if opts.Limit > 200 {
		opts.Limit = 200
	}
	if opts.Offset < 0 {
		opts.Offset = 0
	}

	orderBy := strings.TrimSpace(opts.OrderBy)
	if orderBy == "" {
		orderBy = "created_on"
	}
	direction := strings.ToLower(strings.TrimSpace(opts.OrderDirection))
	if direction == "" {
		direction = "desc"
	}
	if direction != "asc" && direction != "desc" {
		return ListOptions{}, &ValidationError{Message: "orderDirection must be asc or desc"}
	}

	switch orderBy {
	case "created_on", "modified_on", "version":
	default:
		found := false
		if schema != nil {
			for _, field := range schema.Fields {
				if field.Name == orderBy {
					found = true
					break
				}
			}
		}
		if !found {
			return ListOptions{}, &ValidationError{
				Field:   orderBy,
				Message: "invalid orderBy field",
			}
		}
	}

	opts.OrderBy = orderBy
	opts.OrderDirection = direction

	if err := validateFilterExpr(opts.FilterExpr, schema); err != nil {
		return ListOptions{}, err
	}
	if opts.FilterExpr.Combinator == "" && !opts.FilterExpr.Empty() {
		opts.FilterExpr.Combinator = "And"
	}

	return opts, nil
}
