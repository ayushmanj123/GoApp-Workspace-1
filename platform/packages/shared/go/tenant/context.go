// Package tenant provides multi-tenant context propagation for GoApps Platform.
package tenant

import "context"

// Header names used for tenant context extraction.
const (
	HeaderTenantID       = "X-Tenant-ID"
	HeaderOrganizationID = "X-Organization-ID"
	HeaderUserID         = "X-User-ID"
)

// Context holds tenant-scoped identity extracted from incoming requests.
// Values are populated at runtime from JWT claims or headers — never hardcoded.
type Context struct {
	TenantID       string
	UserID         string
	OrganizationID string
	RequestID      string
}

type contextKey struct{}

// WithContext stores a TenantContext in the given context.
func WithContext(ctx context.Context, tc *Context) context.Context {
	return context.WithValue(ctx, contextKey{}, tc)
}

// FromContext retrieves the TenantContext from context, or nil if not present.
func FromContext(ctx context.Context) *Context {
	if tc, ok := ctx.Value(contextKey{}).(*Context); ok {
		return tc
	}
	return nil
}

// HasTenantID returns true if the context contains a non-empty tenant ID.
func HasTenantID(ctx context.Context) bool {
	tc := FromContext(ctx)
	return tc != nil && tc.TenantID != ""
}
