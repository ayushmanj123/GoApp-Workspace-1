package services

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
)

type ScreenService struct {
	store repositories.Store
}

func NewScreenService(store repositories.Store) *ScreenService { return &ScreenService{store: store} }

func (s *ScreenService) Create(ctx context.Context, tenantID, appID uuid.UUID, name string, displayOrder int, layoutType string) (*models.Screen, error) {
	session := s.store.WithTenant(ctx, tenantID)
	scr := &models.Screen{TenantID: tenantID, ApplicationID: appID, Name: name, DisplayOrder: displayOrder, LayoutType: layoutType}
	if err := session.Screens().Create(ctx, scr); err != nil { return nil, fmt.Errorf("create screen: %w", err) }
	return scr, nil
}

func (s *ScreenService) ListByApplication(ctx context.Context, tenantID, appID uuid.UUID, limit, offset int, q string) ([]models.Screen, int64, error) {
	session := s.store.WithTenant(ctx, tenantID)
	items, err := session.Screens().ListByTenant(ctx, tenantID, limit, offset)
	if err != nil { return nil, 0, fmt.Errorf("list screens: %w", err) }
	var out []models.Screen
	for _, it := range items {
		if it.ApplicationID == appID {
			if q == "" || containsIgnoreCase(it.Name, q) { out = append(out, it) }
		}
	}
	return out, int64(len(out)), nil
}

func (s *ScreenService) Update(ctx context.Context, tenantID, id uuid.UUID, updates map[string]interface{}) (*models.Screen, error) {
	session := s.store.WithTenant(ctx, tenantID)
	scr, err := session.Screens().GetByID(ctx, id)
	if err != nil { return nil, fmt.Errorf("get screen for update: %w", err) }
	if v, ok := updates["name"].(string); ok { scr.Name = v }
	if v, ok := updates["layout_type"].(string); ok { scr.LayoutType = v }
	if v, ok := updates["display_order"].(int); ok { scr.DisplayOrder = v }
	if err := session.Screens().Update(ctx, scr); err != nil { return nil, fmt.Errorf("update screen: %w", err) }
	return scr, nil
}

func (s *ScreenService) Delete(ctx context.Context, tenantID, id uuid.UUID) error { session := s.store.WithTenant(ctx, tenantID); return session.Screens().Delete(ctx, id) }

// helper reused
func containsIgnoreCase(s, sub string) bool {
	if len(sub) == 0 { return true }
	Ss := []rune(s)
	Sub := []rune(sub)
	for i := 0; i+len(Sub) <= len(Ss); i++ {
		match := true
		for j := range Sub {
			ch1 := Ss[i+j]
			ch2 := Sub[j]
			if toLower(ch1) != toLower(ch2) { match = false; break }
		}
		if match { return true }
	}
	return false
}

func toLower(r rune) rune { if r >= 'A' && r <= 'Z' { return r + ('a' - 'A') } ; return r }
