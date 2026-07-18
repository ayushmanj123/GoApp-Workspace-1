package databinding

import (
	"fmt"
	"strings"
)

// ValidateNamedSQLQuery allows a single SELECT statement for gallery list actions.
// The query must not contain semicolons (no multi-statement). LIMIT/OFFSET are appended by the datasource.
func ValidateNamedSQLQuery(query string) error {
	q := strings.TrimSpace(query)
	if q == "" {
		return fmt.Errorf("databinding: named sql query is empty")
	}
	if strings.Contains(q, ";") {
		return fmt.Errorf("databinding: named sql query must be a single statement")
	}
	upper := strings.ToUpper(q)
	if !strings.HasPrefix(upper, "SELECT") && !strings.HasPrefix(upper, "WITH") {
		return fmt.Errorf("databinding: named sql query must be SELECT (or WITH … SELECT)")
	}
	return nil
}

// WrapNamedSQLWithPaging wraps a validated SELECT in a subquery with LIMIT/OFFSET placeholders.
func WrapNamedSQLWithPaging(query string) (string, error) {
	if err := ValidateNamedSQLQuery(query); err != nil {
		return "", err
	}
	return fmt.Sprintf("SELECT * FROM (%s) AS goapps_named_q LIMIT $1 OFFSET $2", strings.TrimSpace(query)), nil
}
