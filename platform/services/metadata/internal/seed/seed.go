// Package seed provides idempotent seed data for local and development environments.
package seed

import (
	"context"
	"fmt"

	"github.com/goapps-platform/metadata-service/internal/database"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	DevelopmentTenantID = uuid.MustParse("00000000-0000-4000-8000-000000000001")
	AdminUserID         = uuid.MustParse("00000000-0000-4000-8000-000000000002")
	DemoApplicationID   = uuid.MustParse("00000000-0000-4000-8000-000000000003")
	DemoScreenID        = uuid.MustParse("00000000-0000-4000-8000-000000000004")
	DemoButtonID        = uuid.MustParse("00000000-0000-4000-8000-000000000005")
	DemoButtonTextID    = uuid.MustParse("00000000-0000-4000-8000-000000000006")
	DemoAppVersionID    = uuid.MustParse("00000000-0000-4000-8000-000000000007")
)

// Run inserts the required development seed data.
func Run(ctx context.Context, db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("seed: nil database")
	}

	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		tenant := models.Tenant{
			ID:     DevelopmentTenantID,
			Name:   "Development Tenant",
			Status: "active",
		}
		if err := upsert(tx, &tenant, []string{"name", "status", "modified_on"}); err != nil {
			return err
		}

		return database.WithTenantContext(ctx, tx, DevelopmentTenantID, func(scopedTx *gorm.DB) error {
			admin := models.User{
				ID:          AdminUserID,
				TenantID:    DevelopmentTenantID,
				ExternalID:  "keycloak-development-admin",
				Email:       "admin@development.local",
				DisplayName: "Admin User",
			}
			if err := upsert(scopedTx, &admin, []string{"external_id", "email", "display_name", "modified_on"}); err != nil {
				return err
			}

			app := models.Application{
				ID:          DemoApplicationID,
				TenantID:    DevelopmentTenantID,
				Name:        "Demo Application",
				Description: "Low-code platform demonstration application.",
				Status:      "draft",
			}
			if err := upsert(scopedTx, &app, []string{"name", "description", "status", "modified_on"}); err != nil {
				return err
			}

			version := models.ApplicationVersion{
				ID:            DemoAppVersionID,
				TenantID:      DevelopmentTenantID,
				ApplicationID: DemoApplicationID,
				Version:       "0.1.0",
				Status:        "draft",
				Manifest:      datatypes.JSON([]byte(`{"screens":[],"controls":[]}`)),
			}
			if err := upsert(scopedTx, &version, []string{"version", "status", "manifest", "modified_on"}); err != nil {
				return err
			}

			app.CurrentVersionID = &DemoAppVersionID
			if err := upsert(scopedTx, &app, []string{"name", "description", "status", "current_version_id", "modified_on"}); err != nil {
				return err
			}

			screen := models.Screen{
				ID:            DemoScreenID,
				TenantID:      DevelopmentTenantID,
				ApplicationID: DemoApplicationID,
				Name:          "Home",
				DisplayOrder:  0,
				LayoutType:    "responsive",
			}
			if err := upsert(scopedTx, &screen, []string{"name", "display_order", "layout_type", "modified_on"}); err != nil {
				return err
			}

			button := models.Control{
				ID:          DemoButtonID,
				TenantID:    DevelopmentTenantID,
				ScreenID:    DemoScreenID,
				ControlType: "button",
				Name:        "DemoButton",
				X:           32,
				Y:           32,
				Width:       160,
				Height:      44,
				ZIndex:      1,
			}
			if err := upsert(scopedTx, &button, []string{"control_type", "name", "x", "y", "width", "height", "z_index", "modified_on"}); err != nil {
				return err
			}

			property := models.ControlProperty{
				ID:            DemoButtonTextID,
				TenantID:      DevelopmentTenantID,
				ControlID:     DemoButtonID,
				PropertyName:  "text",
				PropertyValue: datatypes.JSON([]byte(`{"value":"Click me"}`)),
			}
			if err := upsert(scopedTx, &property, []string{"property_name", "property_value", "modified_on"}); err != nil {
				return err
			}

			return nil
		})
	})
}

func upsert[T any](tx *gorm.DB, entity *T, updateColumns []string) error {
	if err := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns(updateColumns),
	}).Create(entity).Error; err != nil {
		return fmt.Errorf("seed: upsert: %w", err)
	}
	return nil
}
