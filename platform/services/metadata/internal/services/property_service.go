package services

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"gorm.io/datatypes"
)

type PropertyService struct { store repositories.Store }

func NewPropertyService(store repositories.Store) *PropertyService { return &PropertyService{store: store} }

func (s *PropertyService) Update(ctx context.Context, tenantID, controlID uuid.UUID, props map[string]interface{}) error {
	sess := s.store.WithTenant(ctx, tenantID)
	// load existing properties for this control
	items, err := sess.ControlProperties().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil { return fmt.Errorf("list control properties: %w", err) }
	// index existing by property name
	existing := map[string]*models.ControlProperty{}
	for i := range items {
		if items[i].ControlID == controlID {
			existing[items[i].PropertyName] = &items[i]
		}
	}
	for k, v := range props {
		b, err := json.Marshal(v)
		if err != nil { return fmt.Errorf("marshal property %s: %w", k, err) }
		if cp, ok := existing[k]; ok {
			cp.PropertyValue = datatypes.JSON(b)
			if err := sess.ControlProperties().Update(ctx, cp); err != nil { return fmt.Errorf("update control property: %w", err) }
		} else {
			newCp := &models.ControlProperty{TenantID: tenantID, ControlID: controlID, PropertyName: k, PropertyValue: datatypes.JSON(b)}
			if err := sess.ControlProperties().Create(ctx, newCp); err != nil { return fmt.Errorf("create control property: %w", err) }
		}
	}
	return nil
}

func (s *PropertyService) Get(ctx context.Context, tenantID, controlID uuid.UUID) (map[string]interface{}, error) {
	sess := s.store.WithTenant(ctx, tenantID)
	items, err := sess.ControlProperties().ListByTenant(ctx, tenantID, 0, 0)
	if err != nil { return nil, fmt.Errorf("list control properties: %w", err) }
	out := map[string]interface{}{}
	for _, it := range items {
		if it.ControlID == controlID {
			var v interface{}
			if err := json.Unmarshal(it.PropertyValue, &v); err == nil {
				out[it.PropertyName] = v
			}
		}
	}
	return out, nil
}
