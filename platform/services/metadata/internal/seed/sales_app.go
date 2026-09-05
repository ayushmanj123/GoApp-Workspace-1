package seed

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/goapps-platform/metadata-service/internal/database"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/goapps-platform/metadata-service/internal/scaffold"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Sales Pipeline sample — fixed IDs in the …000070+ range (Customer uses …000010–…000065).
var (
	SalesAppID        = uuid.MustParse("00000000-0000-4000-8000-000000000070")
	SalesHubScreenID  = uuid.MustParse("00000000-0000-4000-8000-000000000071")
	SalesPermissionID = uuid.MustParse("00000000-0000-4000-8000-000000000072")

	SalesLeadEntityID        = uuid.MustParse("00000000-0000-4000-8000-000000000073")
	SalesAccountEntityID     = uuid.MustParse("00000000-0000-4000-8000-000000000074")
	SalesContactEntityID     = uuid.MustParse("00000000-0000-4000-8000-000000000075")
	SalesOpportunityEntityID = uuid.MustParse("00000000-0000-4000-8000-000000000076")
	SalesQuoteEntityID       = uuid.MustParse("00000000-0000-4000-8000-000000000077")
	SalesOrderEntityID       = uuid.MustParse("00000000-0000-4000-8000-000000000078")
	SalesInvoiceEntityID     = uuid.MustParse("00000000-0000-4000-8000-000000000079")

	SalesLeadListScreenID = uuid.MustParse("00000000-0000-4000-8000-000000000080")
	SalesLeadEditScreenID = uuid.MustParse("00000000-0000-4000-8000-000000000081")
	SalesLeadGalleryID    = uuid.MustParse("00000000-0000-4000-8000-000000000082")
	SalesLeadGalleryLblID = uuid.MustParse("00000000-0000-4000-8000-000000000083")
	SalesLeadBtnNewID     = uuid.MustParse("00000000-0000-4000-8000-000000000084")
	SalesLeadBtnEditID    = uuid.MustParse("00000000-0000-4000-8000-000000000085")
	SalesLeadFormID       = uuid.MustParse("00000000-0000-4000-8000-000000000086")
	SalesLeadBtnSubmitID  = uuid.MustParse("00000000-0000-4000-8000-000000000087")
	SalesLeadBtnResetID   = uuid.MustParse("00000000-0000-4000-8000-000000000088")
	SalesLeadBtnBackID    = uuid.MustParse("00000000-0000-4000-8000-000000000089")

	SalesAccountListScreenID = uuid.MustParse("00000000-0000-4000-8000-000000000090")
	SalesAccountEditScreenID = uuid.MustParse("00000000-0000-4000-8000-000000000091")
	SalesAccountGalleryID    = uuid.MustParse("00000000-0000-4000-8000-000000000092")
	SalesAccountGalleryLblID = uuid.MustParse("00000000-0000-4000-8000-000000000093")
	SalesAccountBtnNewID     = uuid.MustParse("00000000-0000-4000-8000-000000000094")
	SalesAccountBtnEditID    = uuid.MustParse("00000000-0000-4000-8000-000000000095")
	SalesAccountFormID       = uuid.MustParse("00000000-0000-4000-8000-000000000096")
	SalesAccountBtnSubmitID  = uuid.MustParse("00000000-0000-4000-8000-000000000097")
	SalesAccountBtnResetID   = uuid.MustParse("00000000-0000-4000-8000-000000000098")
	SalesAccountBtnBackID    = uuid.MustParse("00000000-0000-4000-8000-000000000099")

	SalesContactListScreenID = uuid.MustParse("00000000-0000-4000-8000-0000000000a0")
	SalesContactEditScreenID = uuid.MustParse("00000000-0000-4000-8000-0000000000a1")
	SalesContactGalleryID    = uuid.MustParse("00000000-0000-4000-8000-0000000000a2")
	SalesContactGalleryLblID = uuid.MustParse("00000000-0000-4000-8000-0000000000a3")
	SalesContactBtnNewID     = uuid.MustParse("00000000-0000-4000-8000-0000000000a4")
	SalesContactBtnEditID    = uuid.MustParse("00000000-0000-4000-8000-0000000000a5")
	SalesContactFormID       = uuid.MustParse("00000000-0000-4000-8000-0000000000a6")
	SalesContactBtnSubmitID  = uuid.MustParse("00000000-0000-4000-8000-0000000000a7")
	SalesContactBtnResetID   = uuid.MustParse("00000000-0000-4000-8000-0000000000a8")
	SalesContactBtnBackID    = uuid.MustParse("00000000-0000-4000-8000-0000000000a9")

	SalesOppListScreenID = uuid.MustParse("00000000-0000-4000-8000-0000000000b0")
	SalesOppEditScreenID = uuid.MustParse("00000000-0000-4000-8000-0000000000b1")
	SalesOppGalleryID    = uuid.MustParse("00000000-0000-4000-8000-0000000000b2")
	SalesOppGalleryLblID = uuid.MustParse("00000000-0000-4000-8000-0000000000b3")
	SalesOppBtnNewID     = uuid.MustParse("00000000-0000-4000-8000-0000000000b4")
	SalesOppBtnEditID    = uuid.MustParse("00000000-0000-4000-8000-0000000000b5")
	SalesOppFormID       = uuid.MustParse("00000000-0000-4000-8000-0000000000b6")
	SalesOppBtnSubmitID  = uuid.MustParse("00000000-0000-4000-8000-0000000000b7")
	SalesOppBtnResetID   = uuid.MustParse("00000000-0000-4000-8000-0000000000b8")
	SalesOppBtnBackID    = uuid.MustParse("00000000-0000-4000-8000-0000000000b9")

	SalesQuoteListScreenID = uuid.MustParse("00000000-0000-4000-8000-0000000000c0")
	SalesQuoteEditScreenID = uuid.MustParse("00000000-0000-4000-8000-0000000000c1")
	SalesQuoteGalleryID    = uuid.MustParse("00000000-0000-4000-8000-0000000000c2")
	SalesQuoteGalleryLblID = uuid.MustParse("00000000-0000-4000-8000-0000000000c3")
	SalesQuoteBtnNewID     = uuid.MustParse("00000000-0000-4000-8000-0000000000c4")
	SalesQuoteBtnEditID    = uuid.MustParse("00000000-0000-4000-8000-0000000000c5")
	SalesQuoteFormID       = uuid.MustParse("00000000-0000-4000-8000-0000000000c6")
	SalesQuoteBtnSubmitID  = uuid.MustParse("00000000-0000-4000-8000-0000000000c7")
	SalesQuoteBtnResetID   = uuid.MustParse("00000000-0000-4000-8000-0000000000c8")
	SalesQuoteBtnBackID    = uuid.MustParse("00000000-0000-4000-8000-0000000000c9")

	SalesOrderListScreenID = uuid.MustParse("00000000-0000-4000-8000-0000000000d0")
	SalesOrderEditScreenID = uuid.MustParse("00000000-0000-4000-8000-0000000000d1")
	SalesOrderGalleryID    = uuid.MustParse("00000000-0000-4000-8000-0000000000d2")
	SalesOrderGalleryLblID = uuid.MustParse("00000000-0000-4000-8000-0000000000d3")
	SalesOrderBtnNewID     = uuid.MustParse("00000000-0000-4000-8000-0000000000d4")
	SalesOrderBtnEditID    = uuid.MustParse("00000000-0000-4000-8000-0000000000d5")
	SalesOrderFormID       = uuid.MustParse("00000000-0000-4000-8000-0000000000d6")
	SalesOrderBtnSubmitID  = uuid.MustParse("00000000-0000-4000-8000-0000000000d7")
	SalesOrderBtnResetID   = uuid.MustParse("00000000-0000-4000-8000-0000000000d8")
	SalesOrderBtnBackID    = uuid.MustParse("00000000-0000-4000-8000-0000000000d9")

	SalesInvoiceListScreenID = uuid.MustParse("00000000-0000-4000-8000-0000000000e0")
	SalesInvoiceEditScreenID = uuid.MustParse("00000000-0000-4000-8000-0000000000e1")
	SalesInvoiceGalleryID    = uuid.MustParse("00000000-0000-4000-8000-0000000000e2")
	SalesInvoiceGalleryLblID = uuid.MustParse("00000000-0000-4000-8000-0000000000e3")
	SalesInvoiceBtnNewID     = uuid.MustParse("00000000-0000-4000-8000-0000000000e4")
	SalesInvoiceBtnEditID    = uuid.MustParse("00000000-0000-4000-8000-0000000000e5")
	SalesInvoiceFormID       = uuid.MustParse("00000000-0000-4000-8000-0000000000e6")
	SalesInvoiceBtnSubmitID  = uuid.MustParse("00000000-0000-4000-8000-0000000000e7")
	SalesInvoiceBtnResetID   = uuid.MustParse("00000000-0000-4000-8000-0000000000e8")
	SalesInvoiceBtnBackID    = uuid.MustParse("00000000-0000-4000-8000-0000000000e9")

	SalesHubLblTitleID    = uuid.MustParse("00000000-0000-4000-8000-0000000000f0")
	SalesHubLblPipelineID = uuid.MustParse("00000000-0000-4000-8000-0000000000f1")
	SalesHubBtnLeadsID    = uuid.MustParse("00000000-0000-4000-8000-0000000000f2")
	SalesHubBtnAccountsID = uuid.MustParse("00000000-0000-4000-8000-0000000000f3")
	SalesHubBtnContactsID = uuid.MustParse("00000000-0000-4000-8000-0000000000f4")
	SalesHubBtnOppsID     = uuid.MustParse("00000000-0000-4000-8000-0000000000f5")
	SalesHubBtnQuotesID   = uuid.MustParse("00000000-0000-4000-8000-0000000000f6")
	SalesHubBtnOrdersID   = uuid.MustParse("00000000-0000-4000-8000-0000000000f7")
	SalesHubBtnInvoicesID = uuid.MustParse("00000000-0000-4000-8000-0000000000f8")

	SalesLeadBtnQualifyID  = uuid.MustParse("00000000-0000-4000-8000-000000000100")
	SalesLeadLblQualifyID  = uuid.MustParse("00000000-0000-4000-8000-000000000101")
	SalesLeadBtnHubID      = uuid.MustParse("00000000-0000-4000-8000-000000000102")
	SalesOppLblStageHintID = uuid.MustParse("00000000-0000-4000-8000-000000000103")
	SalesOppBtnHubID       = uuid.MustParse("00000000-0000-4000-8000-000000000104")
	SalesAccountBtnHubID   = uuid.MustParse("00000000-0000-4000-8000-000000000105")
	SalesContactBtnHubID   = uuid.MustParse("00000000-0000-4000-8000-000000000106")
	SalesQuoteBtnHubID     = uuid.MustParse("00000000-0000-4000-8000-000000000107")
	SalesOrderBtnHubID     = uuid.MustParse("00000000-0000-4000-8000-000000000108")
	SalesInvoiceBtnHubID   = uuid.MustParse("00000000-0000-4000-8000-000000000109")

	SalesLeadRecordIdLblID     = uuid.MustParse("00000000-0000-4000-8000-000000000230")
	SalesAccountRecordIdLblID  = uuid.MustParse("00000000-0000-4000-8000-000000000231")
	SalesContactRecordIdLblID  = uuid.MustParse("00000000-0000-4000-8000-000000000232")
	SalesOppRecordIdLblID      = uuid.MustParse("00000000-0000-4000-8000-000000000233")
	SalesQuoteRecordIdLblID    = uuid.MustParse("00000000-0000-4000-8000-000000000234")
	SalesOrderRecordIdLblID    = uuid.MustParse("00000000-0000-4000-8000-000000000235")
	SalesInvoiceRecordIdLblID  = uuid.MustParse("00000000-0000-4000-8000-000000000236")
)

func salesUUID(suffix string) uuid.UUID {
	return uuid.MustParse("00000000-0000-4000-8000-" + suffix)
}

func ptrUUID(id uuid.UUID) *uuid.UUID { return &id }

type salesEntitySpec struct {
	Name           string
	Columns        []string
	ListScreenID   uuid.UUID
	EditScreenID   uuid.UUID
	GalleryID      uuid.UUID
	GalleryLblID   uuid.UUID
	BtnNewID       uuid.UUID
	BtnEditID      uuid.UUID
	FormID         uuid.UUID
	BtnSubmitID    uuid.UUID
	BtnResetID     uuid.UUID
	BtnBackID      uuid.UUID
	ListControl    string
	FormName       string
	ListScreenName string
	EditScreenName string
	DisplayOrder   int
}

// SeedSalesApp inserts the Sales Pipeline sample application metadata (scope B).
func SeedSalesApp(ctx context.Context, tx *gorm.DB) error {
	if tx == nil {
		return fmt.Errorf("seed sales app: nil database")
	}
	return database.WithTenantContext(ctx, tx, DevelopmentTenantID, func(scopedTx *gorm.DB) error {
		onStart := `Set(varUserName, User().FullName)`
		app := models.Application{
			ID:          SalesAppID,
			TenantID:    DevelopmentTenantID,
			Name:        "Sales Pipeline",
			Description: "Sample Lead→Opportunity→Quote→Order→Invoice pipeline for runtime validation",
			Status:      "draft",
			OnStart:     &onStart,
		}
		if err := upsert(scopedTx, &app, []string{"name", "description", "status", "on_start", "modified_on"}); err != nil {
			return err
		}

		if err := seedSalesEntities(scopedTx); err != nil {
			return err
		}

		hub := models.Screen{
			ID:            SalesHubScreenID,
			TenantID:      DevelopmentTenantID,
			ApplicationID: SalesAppID,
			Name:          "SalesHub",
			DisplayOrder:  0,
			LayoutType:    "responsive",
		}
		if err := upsert(scopedTx, &hub, []string{"name", "display_order", "layout_type", "on_visible", "modified_on"}); err != nil {
			return err
		}

		listVisible := `UpdateContext({ScreenReady: true})`
		sess := repositories.NewGormStore(scopedTx).WithTenant(ctx, DevelopmentTenantID)

		specs := []salesEntitySpec{
			{
				Name: "Lead",
				Columns: []string{"Name", "Company", "Email", "Source", "Status", "Budget", "Timeline", "Notes"},
				ListScreenID: SalesLeadListScreenID, EditScreenID: SalesLeadEditScreenID,
				GalleryID: SalesLeadGalleryID, GalleryLblID: SalesLeadGalleryLblID,
				BtnNewID: SalesLeadBtnNewID, BtnEditID: SalesLeadBtnEditID, FormID: SalesLeadFormID,
				BtnSubmitID: SalesLeadBtnSubmitID, BtnResetID: SalesLeadBtnResetID, BtnBackID: SalesLeadBtnBackID,
				ListControl: "galleryLeads", FormName: "formLead",
				ListScreenName: "LeadList", EditScreenName: "LeadEdit", DisplayOrder: 10,
			},
			{
				Name: "Account",
				Columns: []string{"Name", "Industry", "Phone", "Website"},
				ListScreenID: SalesAccountListScreenID, EditScreenID: SalesAccountEditScreenID,
				GalleryID: SalesAccountGalleryID, GalleryLblID: SalesAccountGalleryLblID,
				BtnNewID: SalesAccountBtnNewID, BtnEditID: SalesAccountBtnEditID, FormID: SalesAccountFormID,
				BtnSubmitID: SalesAccountBtnSubmitID, BtnResetID: SalesAccountBtnResetID, BtnBackID: SalesAccountBtnBackID,
				ListControl: "galleryAccounts", FormName: "formAccount",
				ListScreenName: "AccountList", EditScreenName: "AccountEdit", DisplayOrder: 20,
			},
			{
				Name: "Contact",
				Columns: []string{"Name", "Email", "Phone", "AccountId"},
				ListScreenID: SalesContactListScreenID, EditScreenID: SalesContactEditScreenID,
				GalleryID: SalesContactGalleryID, GalleryLblID: SalesContactGalleryLblID,
				BtnNewID: SalesContactBtnNewID, BtnEditID: SalesContactBtnEditID, FormID: SalesContactFormID,
				BtnSubmitID: SalesContactBtnSubmitID, BtnResetID: SalesContactBtnResetID, BtnBackID: SalesContactBtnBackID,
				ListControl: "galleryContacts", FormName: "formContact",
				ListScreenName: "ContactList", EditScreenName: "ContactEdit", DisplayOrder: 30,
			},
			{
				Name: "Opportunity",
				Columns: []string{"Name", "Stage", "EstimatedRevenue", "Probability", "AccountId", "ContactId", "LeadId", "Notes"},
				ListScreenID: SalesOppListScreenID, EditScreenID: SalesOppEditScreenID,
				GalleryID: SalesOppGalleryID, GalleryLblID: SalesOppGalleryLblID,
				BtnNewID: SalesOppBtnNewID, BtnEditID: SalesOppBtnEditID, FormID: SalesOppFormID,
				BtnSubmitID: SalesOppBtnSubmitID, BtnResetID: SalesOppBtnResetID, BtnBackID: SalesOppBtnBackID,
				ListControl: "galleryOpportunities", FormName: "formOpportunity",
				ListScreenName: "OpportunityList", EditScreenName: "OpportunityEdit", DisplayOrder: 40,
			},
			{
				Name: "Quote",
				Columns: []string{"Name", "Status", "OpportunityId", "Amount"},
				ListScreenID: SalesQuoteListScreenID, EditScreenID: SalesQuoteEditScreenID,
				GalleryID: SalesQuoteGalleryID, GalleryLblID: SalesQuoteGalleryLblID,
				BtnNewID: SalesQuoteBtnNewID, BtnEditID: SalesQuoteBtnEditID, FormID: SalesQuoteFormID,
				BtnSubmitID: SalesQuoteBtnSubmitID, BtnResetID: SalesQuoteBtnResetID, BtnBackID: SalesQuoteBtnBackID,
				ListControl: "galleryQuotes", FormName: "formQuote",
				ListScreenName: "QuoteList", EditScreenName: "QuoteEdit", DisplayOrder: 50,
			},
			{
				Name: "Order",
				Columns: []string{"Name", "Status", "QuoteId", "Amount"},
				ListScreenID: SalesOrderListScreenID, EditScreenID: SalesOrderEditScreenID,
				GalleryID: SalesOrderGalleryID, GalleryLblID: SalesOrderGalleryLblID,
				BtnNewID: SalesOrderBtnNewID, BtnEditID: SalesOrderBtnEditID, FormID: SalesOrderFormID,
				BtnSubmitID: SalesOrderBtnSubmitID, BtnResetID: SalesOrderBtnResetID, BtnBackID: SalesOrderBtnBackID,
				ListControl: "galleryOrders", FormName: "formOrder",
				ListScreenName: "OrderList", EditScreenName: "OrderEdit", DisplayOrder: 60,
			},
			{
				Name: "Invoice",
				Columns: []string{"Name", "Status", "OrderId", "Amount"},
				ListScreenID: SalesInvoiceListScreenID, EditScreenID: SalesInvoiceEditScreenID,
				GalleryID: SalesInvoiceGalleryID, GalleryLblID: SalesInvoiceGalleryLblID,
				BtnNewID: SalesInvoiceBtnNewID, BtnEditID: SalesInvoiceBtnEditID, FormID: SalesInvoiceFormID,
				BtnSubmitID: SalesInvoiceBtnSubmitID, BtnResetID: SalesInvoiceBtnResetID, BtnBackID: SalesInvoiceBtnBackID,
				ListControl: "galleryInvoices", FormName: "formInvoice",
				ListScreenName: "InvoiceList", EditScreenName: "InvoiceEdit", DisplayOrder: 70,
			},
		}

		for _, spec := range specs {
			if err := scaffold.CreateCRUDApp(ctx, sess, scaffold.CRUDAppInput{
				TenantID:           DevelopmentTenantID,
				ApplicationID:      SalesAppID,
				DataSourceName:     spec.Name,
				Template:           scaffold.TemplateGalleryForm,
				Columns:            spec.Columns,
				FormDefaultFormula: "Defaults(" + spec.Name + ")",
				ListOnVisible:      &listVisible,
				UpsertDB:           scopedTx,
				Names: &scaffold.CRUDAppNames{
					ListScreen:   spec.ListScreenName,
					EditScreen:   spec.EditScreenName,
					ListControl:  spec.ListControl,
					GalleryLabel: "lblGalleryName",
					Form:         spec.FormName,
					BtnNew:       "btnNew",
					BtnEdit:      "btnEdit",
					BtnSubmit:    "btnSubmit",
					BtnReset:     "btnReset",
					BtnBack:      "btnBack",
				},
				FixedIDs: &scaffold.CRUDAppFixedIDs{
					ListScreenID:   spec.ListScreenID,
					EditScreenID:   spec.EditScreenID,
					GalleryID:      spec.GalleryID,
					GalleryLabelID: spec.GalleryLblID,
					BtnNewID:       spec.BtnNewID,
					BtnEditID:      spec.BtnEditID,
					FormID:         spec.FormID,
					BtnSubmitID:    spec.BtnSubmitID,
					BtnResetID:     spec.BtnResetID,
					BtnBackID:      spec.BtnBackID,
				},
			}); err != nil {
				return fmt.Errorf("seed sales %s CRUD: %w", spec.Name, err)
			}
			listScreen := models.Screen{
				ID:            spec.ListScreenID,
				TenantID:      DevelopmentTenantID,
				ApplicationID: SalesAppID,
				Name:          spec.ListScreenName,
				DisplayOrder:  spec.DisplayOrder,
				LayoutType:    "responsive",
				OnVisible:     &listVisible,
			}
			if err := upsert(scopedTx, &listScreen, []string{"name", "display_order", "layout_type", "on_visible", "modified_on"}); err != nil {
				return err
			}
			editScreen := models.Screen{
				ID:            spec.EditScreenID,
				TenantID:      DevelopmentTenantID,
				ApplicationID: SalesAppID,
				Name:          spec.EditScreenName,
				DisplayOrder:  spec.DisplayOrder + 1,
				LayoutType:    "responsive",
			}
			if err := upsert(scopedTx, &editScreen, []string{"name", "display_order", "layout_type", "on_visible", "modified_on"}); err != nil {
				return err
			}
		}

		hub.DisplayOrder = 0
		if err := upsert(scopedTx, &hub, []string{"name", "display_order", "layout_type", "on_visible", "modified_on"}); err != nil {
			return err
		}

		if err := seedSalesHubAndExtras(scopedTx); err != nil {
			return err
		}

		if err := seedSalesDogfoodHardening(scopedTx); err != nil {
			return err
		}

		permission := models.Permission{
			ID:             SalesPermissionID,
			TenantID:       DevelopmentTenantID,
			ApplicationID:  SalesAppID,
			RoleName:       "PlatformAdmin",
			PermissionName: "admin",
		}
		return upsert(scopedTx, &permission, []string{"role_name", "permission_name", "modified_on"})
	})
}

func seedSalesEntities(scopedTx *gorm.DB) error {
	entities := []models.Entity{
		{ID: SalesLeadEntityID, TenantID: DevelopmentTenantID, ApplicationID: SalesAppID, Name: "Lead", DisplayName: "Lead"},
		{ID: SalesAccountEntityID, TenantID: DevelopmentTenantID, ApplicationID: SalesAppID, Name: "Account", DisplayName: "Account"},
		{ID: SalesContactEntityID, TenantID: DevelopmentTenantID, ApplicationID: SalesAppID, Name: "Contact", DisplayName: "Contact"},
		{ID: SalesOpportunityEntityID, TenantID: DevelopmentTenantID, ApplicationID: SalesAppID, Name: "Opportunity", DisplayName: "Opportunity"},
		{ID: SalesQuoteEntityID, TenantID: DevelopmentTenantID, ApplicationID: SalesAppID, Name: "Quote", DisplayName: "Quote"},
		{ID: SalesOrderEntityID, TenantID: DevelopmentTenantID, ApplicationID: SalesAppID, Name: "Order", DisplayName: "Order"},
		{ID: SalesInvoiceEntityID, TenantID: DevelopmentTenantID, ApplicationID: SalesAppID, Name: "Invoice", DisplayName: "Invoice"},
	}
	for i := range entities {
		if err := upsert(scopedTx, &entities[i], []string{"name", "display_name", "modified_on"}); err != nil {
			return err
		}
	}

	accountRef := ptrUUID(SalesAccountEntityID)
	contactRef := ptrUUID(SalesContactEntityID)
	leadRef := ptrUUID(SalesLeadEntityID)
	oppRef := ptrUUID(SalesOpportunityEntityID)
	quoteRef := ptrUUID(SalesQuoteEntityID)
	orderRef := ptrUUID(SalesOrderEntityID)

	fields := []models.EntityField{
		{ID: salesUUID("000000000110"), TenantID: DevelopmentTenantID, EntityID: SalesLeadEntityID, Name: "Name", DisplayName: "Name", FieldType: "text", IsRequired: true},
		{ID: salesUUID("000000000111"), TenantID: DevelopmentTenantID, EntityID: SalesLeadEntityID, Name: "Company", DisplayName: "Company", FieldType: "text"},
		{ID: salesUUID("000000000112"), TenantID: DevelopmentTenantID, EntityID: SalesLeadEntityID, Name: "Email", DisplayName: "Email", FieldType: "text"},
		{ID: salesUUID("000000000113"), TenantID: DevelopmentTenantID, EntityID: SalesLeadEntityID, Name: "Source", DisplayName: "Source", FieldType: "text"},
		{ID: salesUUID("000000000114"), TenantID: DevelopmentTenantID, EntityID: SalesLeadEntityID, Name: "Status", DisplayName: "Status", FieldType: "text", IsRequired: true},
		{ID: salesUUID("000000000115"), TenantID: DevelopmentTenantID, EntityID: SalesLeadEntityID, Name: "Budget", DisplayName: "Budget", FieldType: "text"},
		{ID: salesUUID("000000000116"), TenantID: DevelopmentTenantID, EntityID: SalesLeadEntityID, Name: "Timeline", DisplayName: "Timeline", FieldType: "text"},
		{ID: salesUUID("000000000117"), TenantID: DevelopmentTenantID, EntityID: SalesLeadEntityID, Name: "Notes", DisplayName: "Notes", FieldType: "text"},
		{ID: salesUUID("000000000120"), TenantID: DevelopmentTenantID, EntityID: SalesAccountEntityID, Name: "Name", DisplayName: "Name", FieldType: "text", IsRequired: true},
		{ID: salesUUID("000000000121"), TenantID: DevelopmentTenantID, EntityID: SalesAccountEntityID, Name: "Industry", DisplayName: "Industry", FieldType: "text"},
		{ID: salesUUID("000000000122"), TenantID: DevelopmentTenantID, EntityID: SalesAccountEntityID, Name: "Phone", DisplayName: "Phone", FieldType: "text"},
		{ID: salesUUID("000000000123"), TenantID: DevelopmentTenantID, EntityID: SalesAccountEntityID, Name: "Website", DisplayName: "Website", FieldType: "text"},
		{ID: salesUUID("000000000130"), TenantID: DevelopmentTenantID, EntityID: SalesContactEntityID, Name: "Name", DisplayName: "Name", FieldType: "text", IsRequired: true},
		{ID: salesUUID("000000000131"), TenantID: DevelopmentTenantID, EntityID: SalesContactEntityID, Name: "Email", DisplayName: "Email", FieldType: "text"},
		{ID: salesUUID("000000000132"), TenantID: DevelopmentTenantID, EntityID: SalesContactEntityID, Name: "Phone", DisplayName: "Phone", FieldType: "text"},
		{ID: salesUUID("000000000133"), TenantID: DevelopmentTenantID, EntityID: SalesContactEntityID, Name: "AccountId", DisplayName: "Account", FieldType: "lookup", RelatedEntityID: accountRef},
		{ID: salesUUID("000000000140"), TenantID: DevelopmentTenantID, EntityID: SalesOpportunityEntityID, Name: "Name", DisplayName: "Name", FieldType: "text", IsRequired: true},
		{ID: salesUUID("000000000141"), TenantID: DevelopmentTenantID, EntityID: SalesOpportunityEntityID, Name: "Stage", DisplayName: "Stage", FieldType: "text", IsRequired: true},
		{ID: salesUUID("000000000142"), TenantID: DevelopmentTenantID, EntityID: SalesOpportunityEntityID, Name: "EstimatedRevenue", DisplayName: "Estimated Revenue", FieldType: "number"},
		{ID: salesUUID("000000000143"), TenantID: DevelopmentTenantID, EntityID: SalesOpportunityEntityID, Name: "Probability", DisplayName: "Probability", FieldType: "number"},
		{ID: salesUUID("000000000144"), TenantID: DevelopmentTenantID, EntityID: SalesOpportunityEntityID, Name: "AccountId", DisplayName: "Account", FieldType: "lookup", RelatedEntityID: accountRef},
		{ID: salesUUID("000000000145"), TenantID: DevelopmentTenantID, EntityID: SalesOpportunityEntityID, Name: "ContactId", DisplayName: "Contact", FieldType: "lookup", RelatedEntityID: contactRef},
		{ID: salesUUID("000000000146"), TenantID: DevelopmentTenantID, EntityID: SalesOpportunityEntityID, Name: "LeadId", DisplayName: "Lead", FieldType: "lookup", RelatedEntityID: leadRef},
		{ID: salesUUID("000000000147"), TenantID: DevelopmentTenantID, EntityID: SalesOpportunityEntityID, Name: "Notes", DisplayName: "Notes", FieldType: "text"},
		{ID: salesUUID("000000000150"), TenantID: DevelopmentTenantID, EntityID: SalesQuoteEntityID, Name: "Name", DisplayName: "Name", FieldType: "text", IsRequired: true},
		{ID: salesUUID("000000000151"), TenantID: DevelopmentTenantID, EntityID: SalesQuoteEntityID, Name: "Status", DisplayName: "Status", FieldType: "text", IsRequired: true},
		{ID: salesUUID("000000000152"), TenantID: DevelopmentTenantID, EntityID: SalesQuoteEntityID, Name: "OpportunityId", DisplayName: "Opportunity", FieldType: "lookup", RelatedEntityID: oppRef},
		{ID: salesUUID("000000000153"), TenantID: DevelopmentTenantID, EntityID: SalesQuoteEntityID, Name: "Amount", DisplayName: "Amount", FieldType: "number"},
		{ID: salesUUID("000000000160"), TenantID: DevelopmentTenantID, EntityID: SalesOrderEntityID, Name: "Name", DisplayName: "Name", FieldType: "text", IsRequired: true},
		{ID: salesUUID("000000000161"), TenantID: DevelopmentTenantID, EntityID: SalesOrderEntityID, Name: "Status", DisplayName: "Status", FieldType: "text", IsRequired: true},
		{ID: salesUUID("000000000162"), TenantID: DevelopmentTenantID, EntityID: SalesOrderEntityID, Name: "QuoteId", DisplayName: "Quote", FieldType: "lookup", RelatedEntityID: quoteRef},
		{ID: salesUUID("000000000163"), TenantID: DevelopmentTenantID, EntityID: SalesOrderEntityID, Name: "Amount", DisplayName: "Amount", FieldType: "number"},
		{ID: salesUUID("000000000170"), TenantID: DevelopmentTenantID, EntityID: SalesInvoiceEntityID, Name: "Name", DisplayName: "Name", FieldType: "text", IsRequired: true},
		{ID: salesUUID("000000000171"), TenantID: DevelopmentTenantID, EntityID: SalesInvoiceEntityID, Name: "Status", DisplayName: "Status", FieldType: "text", IsRequired: true},
		{ID: salesUUID("000000000172"), TenantID: DevelopmentTenantID, EntityID: SalesInvoiceEntityID, Name: "OrderId", DisplayName: "Order", FieldType: "lookup", RelatedEntityID: orderRef},
		{ID: salesUUID("000000000173"), TenantID: DevelopmentTenantID, EntityID: SalesInvoiceEntityID, Name: "Amount", DisplayName: "Amount", FieldType: "number"},
	}

	fieldCols := []string{"name", "display_name", "field_type", "is_required", "related_entity_id", "modified_on"}
	for i := range fields {
		if err := upsert(scopedTx, &fields[i], fieldCols); err != nil {
			return err
		}
	}
	return nil
}

func seedSalesHubAndExtras(scopedTx *gorm.DB) error {
	controls := []models.Control{
		{ID: SalesHubLblTitleID, TenantID: DevelopmentTenantID, ScreenID: SalesHubScreenID, ControlType: "label", Name: "lblTitle", X: 24, Y: 16, Width: 520, Height: 36, ZIndex: 1},
		{ID: SalesHubLblPipelineID, TenantID: DevelopmentTenantID, ScreenID: SalesHubScreenID, ControlType: "label", Name: "lblPipeline", X: 24, Y: 56, Width: 640, Height: 48, ZIndex: 2},
		{ID: SalesHubBtnLeadsID, TenantID: DevelopmentTenantID, ScreenID: SalesHubScreenID, ControlType: "button", Name: "btnNavLeads", X: 24, Y: 120, Width: 160, Height: 40, ZIndex: 3},
		{ID: SalesHubBtnAccountsID, TenantID: DevelopmentTenantID, ScreenID: SalesHubScreenID, ControlType: "button", Name: "btnNavAccounts", X: 200, Y: 120, Width: 160, Height: 40, ZIndex: 4},
		{ID: SalesHubBtnContactsID, TenantID: DevelopmentTenantID, ScreenID: SalesHubScreenID, ControlType: "button", Name: "btnNavContacts", X: 376, Y: 120, Width: 160, Height: 40, ZIndex: 5},
		{ID: SalesHubBtnOppsID, TenantID: DevelopmentTenantID, ScreenID: SalesHubScreenID, ControlType: "button", Name: "btnNavOpportunities", X: 24, Y: 176, Width: 160, Height: 40, ZIndex: 6},
		{ID: SalesHubBtnQuotesID, TenantID: DevelopmentTenantID, ScreenID: SalesHubScreenID, ControlType: "button", Name: "btnNavQuotes", X: 200, Y: 176, Width: 160, Height: 40, ZIndex: 7},
		{ID: SalesHubBtnOrdersID, TenantID: DevelopmentTenantID, ScreenID: SalesHubScreenID, ControlType: "button", Name: "btnNavOrders", X: 376, Y: 176, Width: 160, Height: 40, ZIndex: 8},
		{ID: SalesHubBtnInvoicesID, TenantID: DevelopmentTenantID, ScreenID: SalesHubScreenID, ControlType: "button", Name: "btnNavInvoices", X: 552, Y: 176, Width: 160, Height: 40, ZIndex: 9},
		{ID: SalesLeadBtnQualifyID, TenantID: DevelopmentTenantID, ScreenID: SalesLeadEditScreenID, ControlType: "button", Name: "btnQualify", X: 24, Y: 500, Width: 140, Height: 40, ZIndex: 10},
		{ID: SalesLeadLblQualifyID, TenantID: DevelopmentTenantID, ScreenID: SalesLeadEditScreenID, ControlType: "label", Name: "lblQualifyHint", X: 180, Y: 500, Width: 400, Height: 40, ZIndex: 11},
		{ID: SalesLeadBtnHubID, TenantID: DevelopmentTenantID, ScreenID: SalesLeadListScreenID, ControlType: "button", Name: "btnHub", X: 560, Y: 208, Width: 120, Height: 40, ZIndex: 7},
		{ID: SalesOppLblStageHintID, TenantID: DevelopmentTenantID, ScreenID: SalesOppEditScreenID, ControlType: "label", Name: "lblStageHint", X: 24, Y: 500, Width: 640, Height: 40, ZIndex: 10},
		{ID: SalesOppBtnHubID, TenantID: DevelopmentTenantID, ScreenID: SalesOppListScreenID, ControlType: "button", Name: "btnHub", X: 560, Y: 208, Width: 120, Height: 40, ZIndex: 7},
		{ID: SalesAccountBtnHubID, TenantID: DevelopmentTenantID, ScreenID: SalesAccountListScreenID, ControlType: "button", Name: "btnHub", X: 560, Y: 208, Width: 120, Height: 40, ZIndex: 7},
		{ID: SalesContactBtnHubID, TenantID: DevelopmentTenantID, ScreenID: SalesContactListScreenID, ControlType: "button", Name: "btnHub", X: 560, Y: 208, Width: 120, Height: 40, ZIndex: 7},
		{ID: SalesQuoteBtnHubID, TenantID: DevelopmentTenantID, ScreenID: SalesQuoteListScreenID, ControlType: "button", Name: "btnHub", X: 560, Y: 208, Width: 120, Height: 40, ZIndex: 7},
		{ID: SalesOrderBtnHubID, TenantID: DevelopmentTenantID, ScreenID: SalesOrderListScreenID, ControlType: "button", Name: "btnHub", X: 560, Y: 208, Width: 120, Height: 40, ZIndex: 7},
		{ID: SalesInvoiceBtnHubID, TenantID: DevelopmentTenantID, ScreenID: SalesInvoiceListScreenID, ControlType: "button", Name: "btnHub", X: 560, Y: 208, Width: 120, Height: 40, ZIndex: 7},
	}

	for i := range controls {
		if err := upsert(scopedTx, &controls[i], []string{"screen_id", "parent_control_id", "control_type", "name", "x", "y", "width", "height", "z_index", "modified_on"}); err != nil {
			return err
		}
	}

	// Qualify: three-arg Patch sets Status; create Account from Company; open Accounts.
	qualifyFormula := `Patch(Lead, formLead.Item, { Status: "Qualified" }); Patch(Account, { Name: formLead.Item.Company }); Navigate(AccountList)`
	qualifyOnSelect, err := json.Marshal(map[string]string{"formula": qualifyFormula})
	if err != nil {
		return err
	}
	qualifyHint, err := json.Marshal(map[string]string{
		"value": "Open Lead in Edit, then Qualify (sets Status=Qualified, creates Account from Company, opens Accounts).",
	})
	if err != nil {
		return err
	}
	properties := []models.ControlProperty{
		{ID: salesUUID("000000000200"), TenantID: DevelopmentTenantID, ControlID: SalesHubLblTitleID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Sales Pipeline"}`))},
		{ID: salesUUID("000000000201"), TenantID: DevelopmentTenantID, ControlID: SalesHubLblPipelineID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Lead → Qualify → Account/Contact + Opportunity → Quote → Order → Invoice → Won/Lost"}`))},
		{ID: salesUUID("000000000202"), TenantID: DevelopmentTenantID, ControlID: SalesHubBtnLeadsID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Leads"}`))},
		{ID: salesUUID("000000000203"), TenantID: DevelopmentTenantID, ControlID: SalesHubBtnLeadsID, PropertyName: "onSelect", PropertyValue: datatypes.JSON([]byte(`{"formula":"Navigate(LeadList)"}`))},
		{ID: salesUUID("000000000204"), TenantID: DevelopmentTenantID, ControlID: SalesHubBtnAccountsID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Accounts"}`))},
		{ID: salesUUID("000000000205"), TenantID: DevelopmentTenantID, ControlID: SalesHubBtnAccountsID, PropertyName: "onSelect", PropertyValue: datatypes.JSON([]byte(`{"formula":"Navigate(AccountList)"}`))},
		{ID: salesUUID("000000000206"), TenantID: DevelopmentTenantID, ControlID: SalesHubBtnContactsID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Contacts"}`))},
		{ID: salesUUID("000000000207"), TenantID: DevelopmentTenantID, ControlID: SalesHubBtnContactsID, PropertyName: "onSelect", PropertyValue: datatypes.JSON([]byte(`{"formula":"Navigate(ContactList)"}`))},
		{ID: salesUUID("000000000208"), TenantID: DevelopmentTenantID, ControlID: SalesHubBtnOppsID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Opportunities"}`))},
		{ID: salesUUID("000000000209"), TenantID: DevelopmentTenantID, ControlID: SalesHubBtnOppsID, PropertyName: "onSelect", PropertyValue: datatypes.JSON([]byte(`{"formula":"Navigate(OpportunityList)"}`))},
		{ID: salesUUID("00000000020a"), TenantID: DevelopmentTenantID, ControlID: SalesHubBtnQuotesID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Quotes"}`))},
		{ID: salesUUID("00000000020b"), TenantID: DevelopmentTenantID, ControlID: SalesHubBtnQuotesID, PropertyName: "onSelect", PropertyValue: datatypes.JSON([]byte(`{"formula":"Navigate(QuoteList)"}`))},
		{ID: salesUUID("00000000020c"), TenantID: DevelopmentTenantID, ControlID: SalesHubBtnOrdersID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Orders"}`))},
		{ID: salesUUID("00000000020d"), TenantID: DevelopmentTenantID, ControlID: SalesHubBtnOrdersID, PropertyName: "onSelect", PropertyValue: datatypes.JSON([]byte(`{"formula":"Navigate(OrderList)"}`))},
		{ID: salesUUID("00000000020e"), TenantID: DevelopmentTenantID, ControlID: SalesHubBtnInvoicesID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Invoices"}`))},
		{ID: salesUUID("00000000020f"), TenantID: DevelopmentTenantID, ControlID: SalesHubBtnInvoicesID, PropertyName: "onSelect", PropertyValue: datatypes.JSON([]byte(`{"formula":"Navigate(InvoiceList)"}`))},
		{ID: salesUUID("000000000210"), TenantID: DevelopmentTenantID, ControlID: SalesLeadBtnQualifyID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Qualify"}`))},
		{ID: salesUUID("000000000211"), TenantID: DevelopmentTenantID, ControlID: SalesLeadBtnQualifyID, PropertyName: "onSelect", PropertyValue: datatypes.JSON(qualifyOnSelect)},
		{ID: salesUUID("000000000212"), TenantID: DevelopmentTenantID, ControlID: SalesLeadLblQualifyID, PropertyName: "text", PropertyValue: datatypes.JSON(qualifyHint)},
		{ID: salesUUID("000000000213"), TenantID: DevelopmentTenantID, ControlID: SalesLeadBtnHubID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Hub"}`))},
		{ID: salesUUID("000000000214"), TenantID: DevelopmentTenantID, ControlID: SalesLeadBtnHubID, PropertyName: "onSelect", PropertyValue: datatypes.JSON([]byte(`{"formula":"Navigate(SalesHub)"}`))},
		{ID: salesUUID("000000000215"), TenantID: DevelopmentTenantID, ControlID: SalesOppLblStageHintID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Stage values: Identify, Develop, Propose, Present, Close, Won, Lost"}`))},
		{ID: salesUUID("000000000216"), TenantID: DevelopmentTenantID, ControlID: SalesOppBtnHubID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Hub"}`))},
		{ID: salesUUID("000000000217"), TenantID: DevelopmentTenantID, ControlID: SalesOppBtnHubID, PropertyName: "onSelect", PropertyValue: datatypes.JSON([]byte(`{"formula":"Navigate(SalesHub)"}`))},
		{ID: salesUUID("000000000218"), TenantID: DevelopmentTenantID, ControlID: SalesAccountBtnHubID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Hub"}`))},
		{ID: salesUUID("000000000219"), TenantID: DevelopmentTenantID, ControlID: SalesAccountBtnHubID, PropertyName: "onSelect", PropertyValue: datatypes.JSON([]byte(`{"formula":"Navigate(SalesHub)"}`))},
		{ID: salesUUID("00000000021a"), TenantID: DevelopmentTenantID, ControlID: SalesContactBtnHubID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Hub"}`))},
		{ID: salesUUID("00000000021b"), TenantID: DevelopmentTenantID, ControlID: SalesContactBtnHubID, PropertyName: "onSelect", PropertyValue: datatypes.JSON([]byte(`{"formula":"Navigate(SalesHub)"}`))},
		{ID: salesUUID("00000000021c"), TenantID: DevelopmentTenantID, ControlID: SalesQuoteBtnHubID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Hub"}`))},
		{ID: salesUUID("00000000021d"), TenantID: DevelopmentTenantID, ControlID: SalesQuoteBtnHubID, PropertyName: "onSelect", PropertyValue: datatypes.JSON([]byte(`{"formula":"Navigate(SalesHub)"}`))},
		{ID: salesUUID("00000000021e"), TenantID: DevelopmentTenantID, ControlID: SalesOrderBtnHubID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Hub"}`))},
		{ID: salesUUID("00000000021f"), TenantID: DevelopmentTenantID, ControlID: SalesOrderBtnHubID, PropertyName: "onSelect", PropertyValue: datatypes.JSON([]byte(`{"formula":"Navigate(SalesHub)"}`))},
		{ID: salesUUID("000000000220"), TenantID: DevelopmentTenantID, ControlID: SalesInvoiceBtnHubID, PropertyName: "text", PropertyValue: datatypes.JSON([]byte(`{"value":"Hub"}`))},
		{ID: salesUUID("000000000221"), TenantID: DevelopmentTenantID, ControlID: SalesInvoiceBtnHubID, PropertyName: "onSelect", PropertyValue: datatypes.JSON([]byte(`{"formula":"Navigate(SalesHub)"}`))},
	}

	for i := range properties {
		if err := upsertProperty(scopedTx, &properties[i]); err != nil {
			return err
		}
	}
	return nil
}

// seedSalesDogfoodHardening applies demo ergonomics: tall forms, Status/Stage defaults,
// and gallery recordId labels for lookup copy-paste.
func seedSalesDogfoodHardening(scopedTx *gorm.DB) error {
	type sizeUpdate struct {
		id     uuid.UUID
		height float64
		y      float64
	}
	forms := []sizeUpdate{
		{SalesLeadFormID, 520, 24},
		{SalesOppFormID, 520, 24},
	}
	for _, f := range forms {
		var ctrl models.Control
		if err := scopedTx.Where("id = ?", f.id).First(&ctrl).Error; err != nil {
			return fmt.Errorf("dogfood: load form %s: %w", f.id, err)
		}
		ctrl.Height = f.height
		ctrl.Y = f.y
		if err := upsert(scopedTx, &ctrl, []string{"screen_id", "parent_control_id", "control_type", "name", "x", "y", "width", "height", "z_index", "modified_on"}); err != nil {
			return err
		}
	}

	actionY := float64(560)
	for _, id := range []uuid.UUID{
		SalesLeadBtnSubmitID, SalesLeadBtnResetID, SalesLeadBtnBackID,
		SalesOppBtnSubmitID, SalesOppBtnResetID, SalesOppBtnBackID,
	} {
		var ctrl models.Control
		if err := scopedTx.Where("id = ?", id).First(&ctrl).Error; err != nil {
			return fmt.Errorf("dogfood: load action button %s: %w", id, err)
		}
		ctrl.Y = actionY
		if err := upsert(scopedTx, &ctrl, []string{"screen_id", "parent_control_id", "control_type", "name", "x", "y", "width", "height", "z_index", "modified_on"}); err != nil {
			return err
		}
	}

	// Qualify + hints below action row
	for _, item := range []struct {
		id uuid.UUID
		y  float64
	}{
		{SalesLeadBtnQualifyID, 612},
		{SalesLeadLblQualifyID, 612},
		{SalesOppLblStageHintID, 612},
	} {
		var ctrl models.Control
		if err := scopedTx.Where("id = ?", item.id).First(&ctrl).Error; err != nil {
			return fmt.Errorf("dogfood: load extra %s: %w", item.id, err)
		}
		ctrl.Y = item.y
		if err := upsert(scopedTx, &ctrl, []string{"screen_id", "parent_control_id", "control_type", "name", "x", "y", "width", "height", "z_index", "modified_on"}); err != nil {
			return err
		}
	}

	if err := setControlDefaultByName(scopedTx, SalesLeadEditScreenID, "txtStatus", "Open", salesUUID("000000000240")); err != nil {
		return err
	}
	if err := setControlDefaultByName(scopedTx, SalesLeadEditScreenID, "cardStatus", "Open", salesUUID("000000000242")); err != nil {
		return err
	}
	if err := setControlDefaultByName(scopedTx, SalesOppEditScreenID, "txtStage", "Identify", salesUUID("000000000241")); err != nil {
		return err
	}
	if err := setControlDefaultByName(scopedTx, SalesOppEditScreenID, "cardStage", "Identify", salesUUID("000000000243")); err != nil {
		return err
	}

	recordLabels := []struct {
		id        uuid.UUID
		galleryID uuid.UUID
		screenID  uuid.UUID
		propID    uuid.UUID
	}{
		{SalesLeadRecordIdLblID, SalesLeadGalleryID, SalesLeadListScreenID, salesUUID("000000000250")},
		{SalesAccountRecordIdLblID, SalesAccountGalleryID, SalesAccountListScreenID, salesUUID("000000000251")},
		{SalesContactRecordIdLblID, SalesContactGalleryID, SalesContactListScreenID, salesUUID("000000000252")},
		{SalesOppRecordIdLblID, SalesOppGalleryID, SalesOppListScreenID, salesUUID("000000000253")},
		{SalesQuoteRecordIdLblID, SalesQuoteGalleryID, SalesQuoteListScreenID, salesUUID("000000000254")},
		{SalesOrderRecordIdLblID, SalesOrderGalleryID, SalesOrderListScreenID, salesUUID("000000000255")},
		{SalesInvoiceRecordIdLblID, SalesInvoiceGalleryID, SalesInvoiceListScreenID, salesUUID("000000000256")},
	}
	for _, rl := range recordLabels {
		parent := rl.galleryID
		ctrl := models.Control{
			ID:              rl.id,
			TenantID:        DevelopmentTenantID,
			ScreenID:        rl.screenID,
			ParentControlID: &parent,
			ControlType:     "label",
			Name:            "lblRecordId",
			X:               8,
			Y:               36,
			Width:           480,
			Height:          20,
			ZIndex:          2,
		}
		if err := upsert(scopedTx, &ctrl, []string{"screen_id", "parent_control_id", "control_type", "name", "x", "y", "width", "height", "z_index", "modified_on"}); err != nil {
			return err
		}
		prop := models.ControlProperty{
			ID:            rl.propID,
			TenantID:      DevelopmentTenantID,
			ControlID:     rl.id,
			PropertyName:  "text",
			PropertyValue: datatypes.JSON([]byte(`{"formula":"ThisItem.recordId"}`)),
		}
		if err := upsertProperty(scopedTx, &prop); err != nil {
			return err
		}
	}

	// Widen name labels so Name stays readable above recordId.
	for _, lblID := range []uuid.UUID{
		SalesLeadGalleryLblID, SalesAccountGalleryLblID, SalesContactGalleryLblID,
		SalesOppGalleryLblID, SalesQuoteGalleryLblID, SalesOrderGalleryLblID, SalesInvoiceGalleryLblID,
	} {
		var ctrl models.Control
		if err := scopedTx.Where("id = ?", lblID).First(&ctrl).Error; err != nil {
			return fmt.Errorf("dogfood: load gallery label %s: %w", lblID, err)
		}
		ctrl.Width = 480
		if err := upsert(scopedTx, &ctrl, []string{"screen_id", "parent_control_id", "control_type", "name", "x", "y", "width", "height", "z_index", "modified_on"}); err != nil {
			return err
		}
	}

	return nil
}

func setControlDefaultByName(scopedTx *gorm.DB, screenID uuid.UUID, controlName, fallback string, propID uuid.UUID) error {
	var ctrl models.Control
	if err := scopedTx.Where("screen_id = ? AND name = ?", screenID, controlName).First(&ctrl).Error; err != nil {
		return fmt.Errorf("dogfood: find %s: %w", controlName, err)
	}
	if err := scopedTx.Where("control_id = ? AND property_name = ?", ctrl.ID, "default").Delete(&models.ControlProperty{}).Error; err != nil {
		return fmt.Errorf("dogfood: clear default on %s: %w", controlName, err)
	}
	field := strings.TrimPrefix(controlName, "txt")
	field = strings.TrimPrefix(field, "card")
	formula := fmt.Sprintf(`If(ThisItem.%s, ThisItem.%s, "%s")`, field, field, fallback)
	prop := models.ControlProperty{
		ID:            propID,
		TenantID:      DevelopmentTenantID,
		ControlID:     ctrl.ID,
		PropertyName:  "default",
		PropertyValue: datatypes.JSON([]byte(fmt.Sprintf(`{"formula":%q}`, formula))),
	}
	return upsertProperty(scopedTx, &prop)
}
