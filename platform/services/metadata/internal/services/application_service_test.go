package services

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/goapps-platform/metadata-service/internal/services/fakes"
)

func TestCreateApplication(t *testing.T) {
	store := fakes.NewFakeStore()
	svc := NewApplicationService(store)
	tenantID := uuid.New()
	app, err := svc.Create(context.Background(), tenantID, "Test App", "desc")
	if err != nil { t.Fatalf("expected no error, got %v", err) }
	if app.Name != "Test App" { t.Fatalf("unexpected name") }
}

func TestListByTenant(t *testing.T) {
	store := fakes.NewFakeStore()
	svc := NewApplicationService(store)
	tenantID := uuid.New()
	_, _ = svc.Create(context.Background(), tenantID, "A1", "d1")
	_, _ = svc.Create(context.Background(), tenantID, "A2", "d2")
	items, total, err := svc.ListByTenant(context.Background(), tenantID, 10, 0)
	if err != nil { t.Fatalf("unexpected error: %v", err) }
	if total != int64(len(items)) { t.Fatalf("expected total match") }
}
