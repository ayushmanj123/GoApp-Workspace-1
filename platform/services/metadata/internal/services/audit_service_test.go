package services

import (
	"context"
	"testing"

	"github.com/goapps-platform/metadata-service/internal/services/fakes"
	"github.com/google/uuid"
)

func TestAuditServiceRecordAndList(t *testing.T) {
	store := fakes.NewFakeStore()
	tenantID := uuid.New()
	userID := uuid.New()
	resourceID := uuid.New()

	svc := NewAuditService(store)
	event, err := svc.Record(context.Background(), tenantID, &userID, "publish", "application", resourceID)
	if err != nil {
		t.Fatalf("record audit event failed: %v", err)
	}
	if event.Action != "publish" || event.ResourceType != "application" {
		t.Fatalf("unexpected audit event: %+v", event)
	}

	items, total, err := svc.List(context.Background(), tenantID, 0, 0)
	if err != nil {
		t.Fatalf("list audit events failed: %v", err)
	}
	if total != 1 || len(items) != 1 {
		t.Fatalf("expected 1 audit event, got %d", total)
	}
	if items[0].ResourceID != resourceID {
		t.Fatalf("expected resource id to match")
	}
}
