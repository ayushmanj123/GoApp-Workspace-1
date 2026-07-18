package databinding

import (
	"fmt"
	"regexp"
	"strings"
)

var sqlIdentPart = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

// ValidateSQLTableName allows empty (named-query connectors), "table", or "schema.table".
func ValidateSQLTableName(table string) error {
	table = strings.TrimSpace(table)
	if table == "" {
		return nil
	}
	parts := strings.Split(table, ".")
	if len(parts) > 2 {
		return fmt.Errorf("databinding: sql table must be table or schema.table")
	}
	for _, part := range parts {
		if !sqlIdentPart.MatchString(part) {
			return fmt.Errorf("databinding: sql table contains an invalid identifier")
		}
	}
	return nil
}

// ValidateSQLPrimaryKey allows empty or a single identifier.
func ValidateSQLPrimaryKey(pk string) error {
	pk = strings.TrimSpace(pk)
	if pk == "" {
		return nil
	}
	if !sqlIdentPart.MatchString(pk) {
		return fmt.Errorf("databinding: sql primary_key contains an invalid identifier")
	}
	return nil
}

// QuoteSQLTable returns a safely quoted FROM target after validation.
func QuoteSQLTable(table string) (string, error) {
	if strings.TrimSpace(table) == "" {
		return "", fmt.Errorf("databinding: sql table is required")
	}
	if err := ValidateSQLTableName(table); err != nil {
		return "", err
	}
	parts := strings.Split(strings.TrimSpace(table), ".")
	quoted := make([]string, len(parts))
	for i, part := range parts {
		quoted[i] = `"` + part + `"`
	}
	return strings.Join(quoted, "."), nil
}

// QuoteSQLIdent quotes a single validated identifier.
func QuoteSQLIdent(ident string) (string, error) {
	ident = strings.TrimSpace(ident)
	if !sqlIdentPart.MatchString(ident) {
		return "", fmt.Errorf("databinding: invalid sql identifier")
	}
	return `"` + ident + `"`, nil
}
