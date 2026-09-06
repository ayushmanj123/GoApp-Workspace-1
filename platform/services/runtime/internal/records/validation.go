package records

import (
	"encoding/json"
	"fmt"
	"math"
	"net/mail"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

var phonePattern = regexp.MustCompile(`^[\d\s\-+().]{3,40}$`)

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
	case "text", "multiline", "email", "phone", "url":
		str, ok := value.(string)
		if !ok {
			return typeError(field.Name, field.FieldType)
		}
		if maxLen := configInt(field.Config, "max_length"); maxLen > 0 && len(str) > maxLen {
			return &ValidationError{Field: field.Name, Message: fmt.Sprintf("exceeds max_length %d", maxLen)}
		}
		switch field.FieldType {
		case "email":
			if _, err := mail.ParseAddress(str); err != nil {
				return &ValidationError{Field: field.Name, Message: "invalid email"}
			}
		case "phone":
			if !phonePattern.MatchString(str) {
				return &ValidationError{Field: field.Name, Message: "invalid phone"}
			}
		case "url":
			u, err := url.ParseRequestURI(str)
			if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
				return &ValidationError{Field: field.Name, Message: "invalid url"}
			}
		}
	case "number", "decimal", "currency":
		n, ok := asFloat(value)
		if !ok {
			return typeError(field.Name, field.FieldType)
		}
		if min, ok := configFloat(field.Config, "min_value"); ok && n < min {
			return &ValidationError{Field: field.Name, Message: "below min_value"}
		}
		if max, ok := configFloat(field.Config, "max_value"); ok && n > max {
			return &ValidationError{Field: field.Name, Message: "above max_value"}
		}
	case "integer":
		n, ok := asFloat(value)
		if !ok || math.Trunc(n) != n {
			return typeError(field.Name, "integer")
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
	case "datetime":
		str, ok := value.(string)
		if !ok {
			return typeError(field.Name, "datetime")
		}
		if _, err := time.Parse(time.RFC3339, str); err != nil {
			return &ValidationError{
				Field:   field.Name,
				Message: "invalid datetime format, expected RFC3339",
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
	case "choice":
		str, ok := value.(string)
		if !ok {
			return typeError(field.Name, "choice")
		}
		if len(field.Options) > 0 && !containsString(field.Options, str) {
			return &ValidationError{Field: field.Name, Message: "value not in choice options"}
		}
	case "choices":
		arr, ok := asStringSlice(value)
		if !ok {
			return typeError(field.Name, "choices")
		}
		for _, item := range arr {
			if len(field.Options) > 0 && !containsString(field.Options, item) {
				return &ValidationError{Field: field.Name, Message: "value not in choice options"}
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
	if arr, ok := value.([]interface{}); ok {
		return len(arr) == 0
	}
	return false
}

func asFloat(value interface{}) (float64, bool) {
	switch v := value.(type) {
	case float64:
		return v, true
	case float32:
		return float64(v), true
	case int:
		return float64(v), true
	case int32:
		return float64(v), true
	case int64:
		return float64(v), true
	case json.Number:
		f, err := v.Float64()
		return f, err == nil
	default:
		return 0, false
	}
}

func asStringSlice(value interface{}) ([]string, bool) {
	switch v := value.(type) {
	case []string:
		return v, true
	case []interface{}:
		out := make([]string, 0, len(v))
		for _, item := range v {
			str, ok := item.(string)
			if !ok {
				return nil, false
			}
			out = append(out, str)
		}
		return out, true
	default:
		return nil, false
	}
}

func containsString(items []string, target string) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}

func configInt(cfg map[string]interface{}, key string) int {
	if cfg == nil {
		return 0
	}
	v, ok := cfg[key]
	if !ok {
		return 0
	}
	f, ok := asFloat(v)
	if !ok {
		return 0
	}
	return int(f)
}

func configFloat(cfg map[string]interface{}, key string) (float64, bool) {
	if cfg == nil {
		return 0, false
	}
	v, ok := cfg[key]
	if !ok {
		return 0, false
	}
	return asFloat(v)
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
