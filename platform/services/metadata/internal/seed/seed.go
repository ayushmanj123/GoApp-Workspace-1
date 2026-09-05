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
	DemoContainerID     = uuid.MustParse("00000000-0000-4000-8000-000000000005")
	DemoLabelID         = uuid.MustParse("00000000-0000-4000-8000-000000000006")
	DemoButtonID        = uuid.MustParse("00000000-0000-4000-8000-000000000007")
	DemoButtonTextID    = uuid.MustParse("00000000-0000-4000-8000-000000000008")
	DemoAppVersionID    = uuid.MustParse("00000000-0000-4000-8000-000000000009")
	DemoPermissionID    = uuid.MustParse("00000000-0000-4000-8000-00000000000a")
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
				Description: "Initial demo application",
				Status:      "draft",
			}
			if err := upsert(scopedTx, &app, []string{"name", "description", "status", "modified_on"}); err != nil {
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

			container := models.Control{
				ID:          DemoContainerID,
				TenantID:    DevelopmentTenantID,
				ScreenID:    DemoScreenID,
				ControlType: "container",
				Name:        "MainContainer",
				X:           0,
				Y:           0,
				Width:       800,
				Height:      600,
				ZIndex:      0,
			}
			if err := upsert(scopedTx, &container, []string{"control_type", "name", "x", "y", "width", "height", "z_index", "modified_on"}); err != nil {
				return err
			}

			label := models.Control{
				ID:          DemoLabelID,
				TenantID:    DevelopmentTenantID,
				ScreenID:    DemoScreenID,
				ControlType: "label",
				Name:        "DemoLabel",
				X:           40,
				Y:           40,
				Width:       320,
				Height:      40,
				ZIndex:      1,
			}
			if err := upsert(scopedTx, &label, []string{"control_type", "name", "x", "y", "width", "height", "z_index", "modified_on"}); err != nil {
				return err
			}

			button := models.Control{
				ID:          DemoButtonID,
				TenantID:    DevelopmentTenantID,
				ScreenID:    DemoScreenID,
				ControlType: "button",
				Name:        "SaveButton",
				X:           32,
				Y:           120,
				Width:       160,
				Height:      44,
				ZIndex:      2,
			}
			if err := upsert(scopedTx, &button, []string{"control_type", "name", "x", "y", "width", "height", "z_index", "modified_on"}); err != nil {
				return err
			}

			labelProperty := models.ControlProperty{
				ID:            DemoButtonTextID,
				TenantID:      DevelopmentTenantID,
				ControlID:     DemoLabelID,
				PropertyName:  "text",
				PropertyValue: datatypes.JSON([]byte(`{"value":"Hello World"}`)),
			}
			if err := upsert(scopedTx, &labelProperty, []string{"property_name", "property_value", "modified_on"}); err != nil {
				return err
			}

			buttonProperty := models.ControlProperty{
				ID:            uuid.MustParse("00000000-0000-4000-8000-00000000000b"),
				TenantID:      DevelopmentTenantID,
				ControlID:     DemoButtonID,
				PropertyName:  "text",
				PropertyValue: datatypes.JSON([]byte(`{"value":"Save"}`)),
			}
			if err := upsert(scopedTx, &buttonProperty, []string{"property_name", "property_value", "modified_on"}); err != nil {
				return err
			}

			permission := models.Permission{
				ID:             DemoPermissionID,
				TenantID:       DevelopmentTenantID,
				ApplicationID:  DemoApplicationID,
				RoleName:       "PlatformAdmin",
				PermissionName: "admin",
			}
			if err := upsert(scopedTx, &permission, []string{"role_name", "permission_name", "modified_on"}); err != nil {
				return err
			}

			if err := SeedCustomerApp(ctx, scopedTx); err != nil {
				return err
			}
			return SeedSalesApp(ctx, scopedTx)
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

// upsertProperty replaces any existing (control_id, property_name) row so re-seed
// stays idempotent under control_properties_control_name_unique.
func upsertProperty(tx *gorm.DB, property *models.ControlProperty) error {
	if err := tx.Where("control_id = ? AND property_name = ?", property.ControlID, property.PropertyName).
		Delete(&models.ControlProperty{}).Error; err != nil {
		return fmt.Errorf("seed: clear property: %w", err)
	}
	return upsert(tx, property, []string{"property_name", "property_value", "modified_on"})
}
