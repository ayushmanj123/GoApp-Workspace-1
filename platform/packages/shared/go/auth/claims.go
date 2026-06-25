// Package auth provides shared authentication middleware and context helpers.
package auth

// Claims represents normalized identity extracted from a validated token.
type Claims struct {
	UserID   string
	TenantID string
	Email    string
	Roles    []string
}
