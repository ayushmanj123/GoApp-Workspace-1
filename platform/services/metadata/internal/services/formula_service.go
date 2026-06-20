package services

import (
	"context"
	"fmt"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/google/uuid"
)

type FormulaService struct{ store repositories.Store }

func NewFormulaService(store repositories.Store) *FormulaService {
	return &FormulaService{store: store}
}

func (s *FormulaService) Create(ctx context.Context, tenantID, controlID uuid.UUID, propName, formulaText, formulaType string) (*models.Formula, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	f := &models.Formula{TenantID: tenantID, ControlID: controlID, PropertyName: propName, FormulaText: formulaText, FormulaType: formulaType}
	if err := sess.Formulas().Create(ctx, f); err != nil {
		return nil, fmt.Errorf("create formula: %w", err)
	}
	return f, nil
}

func (s *FormulaService) ListByControl(ctx context.Context, tenantID, controlID uuid.UUID, limit, offset int, q string) ([]models.Formula, int64, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	items, err := sess.Formulas().ListByTenant(ctx, tenantID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list formulas: %w", err)
	}
	var out []models.Formula
	for _, it := range items {
		if it.ControlID == controlID {
			if q == "" || containsIgnoreCase(it.PropertyName, q) {
				out = append(out, it)
			}
		}
	}
	return out, int64(len(out)), nil
}

func (s *FormulaService) Update(ctx context.Context, tenantID, id uuid.UUID, updates map[string]interface{}) (*models.Formula, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	f, err := sess.Formulas().GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get formula for update: %w", err)
	}
	if v, ok := updates["property_name"].(string); ok {
		f.PropertyName = v
	}
	if v, ok := updates["formula_text"].(string); ok {
		f.FormulaText = v
	}
	if v, ok := updates["formula_type"].(string); ok {
		f.FormulaType = v
	}
	if err := sess.Formulas().Update(ctx, f); err != nil {
		return nil, fmt.Errorf("update formula: %w", err)
	}
	return f, nil
}

func (s *FormulaService) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	sess := s.store.WithTenant(ctx, tenantID)
	return sess.Formulas().Delete(ctx, id)
}
