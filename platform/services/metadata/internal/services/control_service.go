package services

import (
	"context"
	"fmt"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/google/uuid"
)

type ControlService struct{ store repositories.Store }

func NewControlService(store repositories.Store) *ControlService {
	return &ControlService{store: store}
}

func (s *ControlService) Create(ctx context.Context, tenantID, screenID uuid.UUID, name, controlType string, x, y, width, height float64, zIndex int, parentControlID *uuid.UUID) (*models.Control, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	ctl := &models.Control{
		TenantID:        tenantID,
		ScreenID:        screenID,
		ParentControlID: parentControlID,
		ControlType:     controlType,
		Name:            name,
		X:               x,
		Y:               y,
		Width:           width,
		Height:          height,
		ZIndex:          zIndex,
	}
	if err := sess.Controls().Create(ctx, ctl); err != nil {
		return nil, fmt.Errorf("create control: %w", err)
	}
	return ctl, nil
}

func (s *ControlService) ListByScreen(ctx context.Context, tenantID, screenID uuid.UUID, limit, offset int, q string) ([]models.Control, int64, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	items, err := sess.Controls().ListByTenant(ctx, tenantID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list controls: %w", err)
	}
	var out []models.Control
	for _, it := range items {
		if it.ScreenID == screenID {
			if q == "" || containsIgnoreCase(it.Name, q) {
				out = append(out, it)
			}
		}
	}
	return out, int64(len(out)), nil
}

func (s *ControlService) Update(ctx context.Context, tenantID, id uuid.UUID, updates map[string]interface{}) (*models.Control, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	ctl, err := sess.Controls().GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get control for update: %w", err)
	}
	if v, ok := updates["name"].(string); ok {
		ctl.Name = v
	}
	if v, ok := updates["control_type"].(string); ok {
		ctl.ControlType = v
	}
	if v, ok := updates["x"].(float64); ok {
		ctl.X = v
	}
	if v, ok := updates["y"].(float64); ok {
		ctl.Y = v
	}
	if v, ok := updates["width"].(float64); ok {
		ctl.Width = v
	}
	if v, ok := updates["height"].(float64); ok {
		ctl.Height = v
	}
	if v, ok := updates["z_index"].(int); ok {
		ctl.ZIndex = v
	}
	if v, ok := updates["parent_control_id"].(string); ok {
		if v == "" {
			ctl.ParentControlID = nil
		} else {
			if pu, err := uuid.Parse(v); err == nil {
				ctl.ParentControlID = &pu
			}
		}
	}
	if err := sess.Controls().Update(ctx, ctl); err != nil {
		return nil, fmt.Errorf("update control: %w", err)
	}
	return ctl, nil
}

func (s *ControlService) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	sess := s.store.WithTenant(ctx, tenantID)
	return sess.Controls().Delete(ctx, id)
}
