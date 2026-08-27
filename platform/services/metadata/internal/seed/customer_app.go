package seed



import (

	"context"

	"fmt"



	"github.com/goapps-platform/metadata-service/internal/database"

	"github.com/goapps-platform/metadata-service/internal/models"

	"github.com/goapps-platform/metadata-service/internal/repositories"

	"github.com/goapps-platform/metadata-service/internal/scaffold"

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



		listVisible := `UpdateContext({ScreenReady: true})`

		sess := repositories.NewGormStore(scopedTx).WithTenant(ctx, DevelopmentTenantID)

		if err := scaffold.CreateCRUDApp(ctx, sess, scaffold.CRUDAppInput{

			TenantID:           DevelopmentTenantID,

			ApplicationID:      CustomerAppID,

			DataSourceName:     "Customer",

			Template:           scaffold.TemplateGalleryForm,

			FormDefaultFormula: "Defaults(Customer)",

			ListOnVisible:      &listVisible,

			UpsertDB:           scopedTx,

			Names: &scaffold.CRUDAppNames{

				ListScreen:   "CustomerList",

				EditScreen:   "CustomerEdit",

				ListControl:  "galleryCustomers",

				GalleryLabel: "lblGalleryName",

				Form:         "formCustomer",

				BtnNew:       "btnNew",

				BtnEdit:      "btnEdit",

				BtnSubmit:    "btnSubmit",

				BtnReset:     "btnReset",

				BtnBack:      "btnBack",

			},

			FixedIDs: &scaffold.CRUDAppFixedIDs{

				ListScreenID:   CustomerListScreenID,

				EditScreenID:   CustomerEditScreenID,

				GalleryID:      CustomerGalleryID,

				GalleryLabelID: CustomerGalleryNameLblID,

				BtnNewID:       CustomerBtnNewID,

				BtnEditID:      CustomerBtnEditID,

				FormID:         CustomerFormID,

				BtnSubmitID:    CustomerBtnSubmitID,

				BtnResetID:     CustomerBtnResetID,

				BtnBackID:      CustomerBtnBackID,

			},

		}); err != nil {

			return err

		}



		extras := []models.Control{

			{ID: CustomerLblTitleID, TenantID: DevelopmentTenantID, ScreenID: CustomerListScreenID, ControlType: "label", Name: "lblTitle", X: 24, Y: 16, Width: 400, Height: 36, ZIndex: 1},

			{ID: CustomerSearchID, TenantID: DevelopmentTenantID, ScreenID: CustomerListScreenID, ControlType: "textinput", Name: "txtSearch", X: 24, Y: 64, Width: 280, Height: 36, ZIndex: 2},

			{ID: CustomerBtnRefreshID, TenantID: DevelopmentTenantID, ScreenID: CustomerListScreenID, ControlType: "button", Name: "btnRefresh", X: 560, Y: 160, Width: 120, Height: 40, ZIndex: 6},

			{ID: CustomerLblStatusID, TenantID: DevelopmentTenantID, ScreenID: CustomerEditScreenID, ControlType: "label", Name: "lblFormStatus", X: 24, Y: 400, Width: 520, Height: 32, ZIndex: 2},

			{ID: CustomerBtnCancelID, TenantID: DevelopmentTenantID, ScreenID: CustomerEditScreenID, ControlType: "button", Name: "btnCancel", X: 296, Y: 448, Width: 120, Height: 40, ZIndex: 5},

		}

		for _, control := range extras {

			if err := upsert(scopedTx, &control, []string{"screen_id", "parent_control_id", "control_type", "name", "x", "y", "width", "height", "z_index", "modified_on"}); err != nil {

				return err

			}

		}



		properties := []models.ControlProperty{

			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000040"), TenantID: DevelopmentTenantID, ControlID: CustomerSearchID, PropertyName: "default", PropertyValue: datatypes.JSON([]byte(`{"value":""}`))},

			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000043"), TenantID: DevelopmentTenantID, ControlID: CustomerBtnRefreshID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Refresh"}`))},

			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000048"), TenantID: DevelopmentTenantID, ControlID: CustomerBtnCancelID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Cancel"}`))},

			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000060"), TenantID: DevelopmentTenantID, ControlID: CustomerLblTitleID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"formula":"varUserName"}`))},

			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000061"), TenantID: DevelopmentTenantID, ControlID: CustomerLblStatusID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"formula":"If(formCustomer.Valid, \"Valid\", \"Fix validation errors\")"}`))},

			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000062"), TenantID: DevelopmentTenantID, ControlID: CustomerLblStatusID, PropertyName: "visible", PropertyValue: datatypes.JSON([]byte(`{"formula":"formCustomer.Unsaved"}`))},

			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000063"), TenantID: DevelopmentTenantID, ControlID: CustomerBtnRefreshID, PropertyName: "onSelect", PropertyValue: datatypes.JSON([]byte(`{"formula":"Navigate(CustomerList)"}`))},

			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000064"), TenantID: DevelopmentTenantID, ControlID: CustomerBtnCancelID, PropertyName: "onSelect", PropertyValue: datatypes.JSON([]byte(`{"formula":"ResetForm(formCustomer); Back()"}`))},

			{ID: uuid.MustParse("00000000-0000-4000-8000-000000000065"), TenantID: DevelopmentTenantID, ControlID: CustomerSearchID, PropertyName: "onChange", PropertyValue: datatypes.JSON([]byte(`{"formula":"Set(varSearchChanged, true)"}`))},

		}

		for _, property := range properties {

			if err := upsert(scopedTx, &property, []string{"property_name", "property_value", "modified_on"}); err != nil {

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


