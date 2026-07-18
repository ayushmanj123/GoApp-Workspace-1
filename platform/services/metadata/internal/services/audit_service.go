package services

import (
	"context"
	"fmt"

	"github.com/goapps-platform/metadata-service/internal/api/contracts"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/google/uuid"
)

// AuditService writes append-only audit trail entries via the tenant-scoped
// metadata store, so row-level security and tenant isolation apply the same
// way they do for every other metadata table.
type AuditService struct {
	store repositories.Store
}

func NewAuditService(store repositories.Store) *AuditService {
	return &AuditService{store: store}
}

// Record creates a single audit log entry. It never mutates existing rows —
// audit_logs is append-only at the database level (see migration 000002).
func (s *AuditService) Record(ctx context.Context, tenantID uuid.UUID, userID *uuid.UUID, action, resourceType string, resourceID uuid.UUID) (*contracts.AuditEventDTO, error) {
	entry := &models.AuditLog{
		TenantID:     tenantID,
		UserID:       userID,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
	}
	sess := s.store.WithTenant(ctx, tenantID)
	if err := sess.AuditLogs().Create(ctx, entry); err != nil {
		return nil, fmt.Errorf("record audit event: %w", err)
	}
	dto := toAuditEventDTO(entry)
	return &dto, nil
}

func (s *AuditService) List(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]contracts.AuditEventDTO, int64, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	items, err := sess.AuditLogs().ListByTenant(ctx, tenantID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list audit events: %w", err)
	}
	out := make([]contracts.AuditEventDTO, 0, len(items))
	for i := range items {
		out = append(out, toAuditEventDTO(&items[i]))
	}
	return out, int64(len(out)), nil
}

func toAuditEventDTO(entry *models.AuditLog) contracts.AuditEventDTO {
	return contracts.AuditEventDTO{
		ID:           entry.ID,
		TenantID:     entry.TenantID,
		UserID:       entry.UserID,
		Action:       entry.Action,
		ResourceType: entry.ResourceType,
		ResourceID:   entry.ResourceID,
		CreatedOn:    entry.CreatedOn,
	}
}
