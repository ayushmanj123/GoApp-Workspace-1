package seed

import (
	"context"
	"fmt"

	"github.com/goapps-platform/metadata-service/internal/database"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

var (
	CustomerAppID            = uuid.MustParse("00000000-0000-4000-8000-000000000010")
	CustomerListScreenID     = uuid.MustParse("00000000-0000-4000-8000-000000000011")
	CustomerEditScreenID     = uuid.MustParse("00000000-0000-4000-8000-000000000012")
	CustomerEntityID         = uuid.MustParse("00000000-0000-4000-8000-000000000013")
	CustomerPermissionID     = uuid.MustParse("00000000-0000-4000-8000-000000000014")
	CustomerGalleryID        = uuid.MustParse("00000000-0000-4000-8000-000000000015")
	CustomerSearchID         = uuid.MustParse("00000000-0000-4000-8000-000000000016")
	CustomerBtnNewID         = uuid.MustParse("00000000-0000-4000-8000-000000000017")
	CustomerBtnEditID        = uuid.MustParse("00000000-0000-4000-8000-000000000018")
	CustomerBtnRefreshID     = uuid.MustParse("00000000-0000-4000-8000-000000000019")
	CustomerLblTitleID       = uuid.MustParse("00000000-0000-4000-8000-00000000001a")
	CustomerFormID           = uuid.MustParse("00000000-0000-4000-8000-00000000001b")
	CustomerBtnSubmitID      = uuid.MustParse("00000000-0000-4000-8000-00000000001c")
	CustomerBtnResetID       = uuid.MustParse("00000000-0000-4000-8000-00000000001d")
	CustomerBtnCancelID      = uuid.MustParse("00000000-0000-4000-8000-00000000001e")
	CustomerBtnBackID        = uuid.MustParse("00000000-0000-4000-8000-00000000001f")
	CustomerLblStatusID      = uuid.MustParse("00000000-0000-4000-8000-000000000020")
	CustomerGalleryNameLblID = uuid.MustParse("00000000-0000-4000-8000-000000000021")
)

// SeedCustomerApp inserts the Customer Management sample application metadata.
func SeedCustomerApp(ctx context.Context, tx *gorm.DB) error {
	if tx == nil {
		return fmt.Errorf("seed customer app: nil database")
	}
	return database.WithTenantContext(ctx, tx, DevelopmentTenantID, func(scopedTx *gorm.DB) error {
		onStart := `Set(varUserName, User().FullName)`
		app := models.Application{
			ID:          CustomerAppID,
			TenantID:    DevelopmentTenantID,
			Name:        "Customer Management",
			Description: "Sample CRUD application for runtime validation",
			Status:      "draft",
			OnStart:     &onStart,
		}
		if err := upsert(scopedTx, &app, []string{"name", "description", "status", "on_start", "modified_on"}); err != nil {
			return err
		}

		listVisible := `UpdateContext({ScreenReady: true})`
		listScreen := models.Screen{
			ID:            CustomerListScreenID,
			TenantID:      DevelopmentTenantID,
			ApplicationID: CustomerAppID,
			Name:          "CustomerList",
			DisplayOrder:  0,
			LayoutType:    "responsive",
			OnVisible:     &listVisible,
		}
		editScreen := models.Screen{
			ID:            CustomerEditScreenID,
			TenantID:      DevelopmentTenantID,
			ApplicationID: CustomerAppID,
			Name:          "CustomerEdit",
			DisplayOrder:  1,
			LayoutType:    "responsive",
		}
		if err := upsert(scopedTx, &listScreen, []string{"name", "display_order", "layout_type", "on_visible", "modified_on"}); err != nil {
			return err
		}
		if err := upsert(scopedTx, &editScreen, []string{"name", "display_order", "layout_type", "modified_on"}); err != nil {
			return err
		}

		entity := models.Entity{
			ID:            CustomerEntityID,
			TenantID:      DevelopmentTenantID,
			ApplicationID: CustomerAppID,
			Name:          "Customer",
			DisplayName:   "Customer",
		}
		if err := upsert(scopedTx, &entity, []string{"name", "display_name", "modified_on"}); err != nil {
			return err
		}

		fields := []models.EntityField{
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000030"), TenantID: DevelopmentTenantID, EntityID: CustomerEntityID, Name: "Name", DisplayName: "Name", FieldType: "text", IsRequired: true},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000031"), TenantID: DevelopmentTenantID, EntityID: CustomerEntityID, Name: "Email", DisplayName: "Email", FieldType: "text", IsRequired: true},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000032"), TenantID: DevelopmentTenantID, EntityID: CustomerEntityID, Name: "Phone", DisplayName: "Phone", FieldType: "text", IsRequired: false},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000033"), TenantID: DevelopmentTenantID, EntityID: CustomerEntityID, Name: "Status", DisplayName: "Status", FieldType: "text", IsRequired: true},
		}
		for _, field := range fields {
			if err := upsert(scopedTx, &field, []string{"name", "display_name", "field_type", "is_required", "modified_on"}); err != nil {
				return err
			}
		}

		controls := []models.Control{
			{ID: CustomerLblTitleID, TenantID: DevelopmentTenantID, ScreenID: CustomerListScreenID, ControlType: "label", Name: "lblTitle", X: 24, Y: 16, Width: 400, Height: 36, ZIndex: 1},
			{ID: CustomerSearchID, TenantID: DevelopmentTenantID, ScreenID: CustomerListScreenID, ControlType: "textinput", Name: "txtSearch", X: 24, Y: 64, Width: 280, Height: 36, ZIndex: 2},
			{ID: CustomerGalleryID, TenantID: DevelopmentTenantID, ScreenID: CustomerListScreenID, ControlType: "gallery", Name: "galleryCustomers", X: 24, Y: 120, Width: 520, Height: 280, ZIndex: 3},
			{ID: CustomerGalleryNameLblID, TenantID: DevelopmentTenantID, ScreenID: CustomerListScreenID, ParentControlID: ptrUUID(CustomerGalleryID), ControlType: "label", Name: "lblGalleryName", X: 8, Y: 8, Width: 240, Height: 28, ZIndex: 1},
			{ID: CustomerBtnNewID, TenantID: DevelopmentTenantID, ScreenID: CustomerListScreenID, ControlType: "button", Name: "btnNew", X: 560, Y: 64, Width: 120, Height: 40, ZIndex: 4},
			{ID: CustomerBtnEditID, TenantID: DevelopmentTenantID, ScreenID: CustomerListScreenID, ControlType: "button", Name: "btnEdit", X: 560, Y: 112, Width: 120, Height: 40, ZIndex: 5},
			{ID: CustomerBtnRefreshID, TenantID: DevelopmentTenantID, ScreenID: CustomerListScreenID, ControlType: "button", Name: "btnRefresh", X: 560, Y: 160, Width: 120, Height: 40, ZIndex: 6},
			{ID: CustomerFormID, TenantID: DevelopmentTenantID, ScreenID: CustomerEditScreenID, ControlType: "form", Name: "formCustomer", X: 24, Y: 24, Width: 520, Height: 360, ZIndex: 1},
			{ID: CustomerLblStatusID, TenantID: DevelopmentTenantID, ScreenID: CustomerEditScreenID, ControlType: "label", Name: "lblFormStatus", X: 24, Y: 400, Width: 520, Height: 32, ZIndex: 2},
			{ID: CustomerBtnSubmitID, TenantID: DevelopmentTenantID, ScreenID: CustomerEditScreenID, ControlType: "button", Name: "btnSubmit", X: 24, Y: 448, Width: 120, Height: 40, ZIndex: 3},
			{ID: CustomerBtnResetID, TenantID: DevelopmentTenantID, ScreenID: CustomerEditScreenID, ControlType: "button", Name: "btnReset", X: 160, Y: 448, Width: 120, Height: 40, ZIndex: 4},
			{ID: CustomerBtnCancelID, TenantID: DevelopmentTenantID, ScreenID: CustomerEditScreenID, ControlType: "button", Name: "btnCancel", X: 296, Y: 448, Width: 120, Height: 40, ZIndex: 5},
			{ID: CustomerBtnBackID, TenantID: DevelopmentTenantID, ScreenID: CustomerEditScreenID, ControlType: "button", Name: "btnBack", X: 432, Y: 448, Width: 120, Height: 40, ZIndex: 6},
		}
		for _, control := range controls {
			if err := upsert(scopedTx, &control, []string{"screen_id", "parent_control_id", "control_type", "name", "x", "y", "width", "height", "z_index", "modified_on"}); err != nil {
				return err
			}
		}

		properties := []models.ControlProperty{
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000040"), TenantID: DevelopmentTenantID, ControlID: CustomerSearchID, PropertyName: "default", PropertyValue: datatypes.JSON([]byte(`{"value":""}`))},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000041"), TenantID: DevelopmentTenantID, ControlID: CustomerBtnNewID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"New"}`))},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000042"), TenantID: DevelopmentTenantID, ControlID: CustomerBtnEditID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Edit"}`))},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000043"), TenantID: DevelopmentTenantID, ControlID: CustomerBtnRefreshID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Refresh"}`))},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000044"), TenantID: DevelopmentTenantID, ControlID: CustomerFormID, PropertyName: "dataSource", PropertyValue: datatypes.JSON([]byte(`{"value":"Customer"}`))},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000045"), TenantID: DevelopmentTenantID, ControlID: CustomerFormID, PropertyName: "mode", PropertyValue: datatypes.JSON([]byte(`{"kind":"enum","value":"View"}`))},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000046"), TenantID: DevelopmentTenantID, ControlID: CustomerBtnSubmitID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Submit"}`))},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000047"), TenantID: DevelopmentTenantID, ControlID: CustomerBtnResetID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Reset"}`))},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000048"), TenantID: DevelopmentTenantID, ControlID: CustomerBtnCancelID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Cancel"}`))},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000049"), TenantID: DevelopmentTenantID, ControlID: CustomerBtnBackID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Back"}`))},
		}
		for _, property := range properties {
			if err := upsert(scopedTx, &property, []string{"property_name", "property_value", "modified_on"}); err != nil {
				return err
			}
		}

		formulas := []models.Formula{
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000050"), TenantID: DevelopmentTenantID, ControlID: CustomerLblTitleID, PropertyName: "text", FormulaText: `varUserName`, FormulaType: "property"},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000052"), TenantID: DevelopmentTenantID, ControlID: CustomerGalleryID, PropertyName: "items", FormulaText: `Customer`, FormulaType: "property"},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000053"), TenantID: DevelopmentTenantID, ControlID: CustomerGalleryNameLblID, PropertyName: "text", FormulaText: `ThisItem.Name`, FormulaType: "property"},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000054"), TenantID: DevelopmentTenantID, ControlID: CustomerBtnNewID, PropertyName: "onSelect", FormulaText: `NewForm(formCustomer); Navigate(CustomerEdit)`, FormulaType: "behavior"},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000055"), TenantID: DevelopmentTenantID, ControlID: CustomerBtnEditID, PropertyName: "onSelect", FormulaText: `EditForm(formCustomer); Navigate(CustomerEdit)`, FormulaType: "behavior"},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000056"), TenantID: DevelopmentTenantID, ControlID: CustomerBtnRefreshID, PropertyName: "onSelect", FormulaText: `Navigate(CustomerList)`, FormulaType: "behavior"},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000057"), TenantID: DevelopmentTenantID, ControlID: CustomerFormID, PropertyName: "item", FormulaText: `galleryCustomers.Selected`, FormulaType: "property"},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000058"), TenantID: DevelopmentTenantID, ControlID: CustomerFormID, PropertyName: "default", FormulaText: `Defaults(Customer)`, FormulaType: "property"},
			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000059"), TenantID: DevelopmentTenantID, ControlID: CustomerLblStatusID, PropertyName: "text", FormulaText: `If(formCustomer.Valid, "Valid", "Fix validation errors")`, FormulaType: "property"},
			{ID: uuid.MustParse("00000000-0000-4000-8000-00000000005a"), TenantID: DevelopmentTenantID, ControlID: CustomerLblStatusID, PropertyName: "visible", FormulaText: `formCustomer.Unsaved`, FormulaType: "property"},
			{ID: uuid.MustParse("00000000-0000-4000-8000-00000000005b"), TenantID: DevelopmentTenantID, ControlID: CustomerBtnSubmitID, PropertyName: "onSelect", FormulaText: `SubmitForm(formCustomer); Navigate(CustomerList)`, FormulaType: "behavior"},
			{ID: uuid.MustParse("00000000-0000-4000-8000-00000000005c"), TenantID: DevelopmentTenantID, ControlID: CustomerBtnResetID, PropertyName: "onSelect", FormulaText: `ResetForm(formCustomer)`, FormulaType: "behavior"},
			{ID: uuid.MustParse("00000000-0000-4000-8000-00000000005d"), TenantID: DevelopmentTenantID, ControlID: CustomerBtnCancelID, PropertyName: "onSelect", FormulaText: `ResetForm(formCustomer); Back()`, FormulaType: "behavior"},
			{ID: uuid.MustParse("00000000-0000-4000-8000-00000000005e"), TenantID: DevelopmentTenantID, ControlID: CustomerBtnBackID, PropertyName: "onSelect", FormulaText: `Back()`, FormulaType: "behavior"},
			{ID: uuid.MustParse("00000000-0000-4000-8000-00000000005f"), TenantID: DevelopmentTenantID, ControlID: CustomerSearchID, PropertyName: "onChange", FormulaText: `Set(varSearchChanged, true)`, FormulaType: "behavior"},
		}
		for _, formula := range formulas {
			if err := upsert(scopedTx, &formula, []string{"property_name", "formula_text", "formula_type", "modified_on"}); err != nil {
				return err
			}
		}

		permission := models.Permission{
			ID:             CustomerPermissionID,
			TenantID:       DevelopmentTenantID,
			ApplicationID:  CustomerAppID,
			RoleName:       "PlatformAdmin",
			PermissionName: "admin",
		}
		return upsert(scopedTx, &permission, []string{"role_name", "permission_name", "modified_on"})
	})
}

func ptrUUID(id uuid.UUID) *uuid.UUID {
	return &id
}
