package tenant_test

import (
	"context"
	"testing"

	"github.com/goapps-platform/shared/tenant"
)

func TestFromContextEmpty(t *testing.T) {
	tc := tenant.FromContext(context.Background())
	if tc != nil {
		t.Fatal("expected nil tenant context")
	}
}

func TestWithContextRoundTrip(t *testing.T) {
	original := &tenant.Context{
		TenantID:       "tenant-from-request",
		UserID:         "user-from-request",
		OrganizationID: "org-from-request",
		RequestID:      "req-abc",
	}

	ctx := tenant.WithContext(context.Background(), original)
	got := tenant.FromContext(ctx)

	if got.TenantID != original.TenantID {
		t.Fatalf("expected tenantId %q, got %q", original.TenantID, got.TenantID)
	}
	if got.UserID != original.UserID {
		t.Fatalf("expected userId %q, got %q", original.UserID, got.UserID)
	}
}

func TestHasTenantID(t *testing.T) {
	empty := tenant.WithContext(context.Background(), &tenant.Context{})
	if tenant.HasTenantID(empty) {
		t.Fatal("expected false for empty tenant ID")
	}

	withID := tenant.WithContext(context.Background(), &tenant.Context{TenantID: "t-1"})
	if !tenant.HasTenantID(withID) {
		t.Fatal("expected true when tenant ID is set")
	}
}
