package scaffold

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/goapps-platform/metadata-service/internal/repositories"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Template selects the list control layout.
type Template string

const (
	TemplateGalleryForm   Template = "gallery_form"
	TemplateDataTableForm Template = "datatable_form"
)

// CRUDAppNames overrides default generated control and screen names.
type CRUDAppNames struct {
	ListScreen   string
	EditScreen   string
	ListControl  string
	GalleryLabel string
	Form         string
	BtnNew       string
	BtnEdit      string
	BtnSubmit    string
	BtnReset     string
	BtnBack      string
}

// CRUDAppFixedIDs pins deterministic ids for idempotent seed upserts.
type CRUDAppFixedIDs struct {
	ListScreenID   uuid.UUID
	EditScreenID   uuid.UUID
	GalleryID      uuid.UUID
	GalleryLabelID uuid.UUID
	BtnNewID       uuid.UUID
	BtnEditID      uuid.UUID
	FormID         uuid.UUID
	BtnSubmitID    uuid.UUID
	BtnResetID     uuid.UUID
	BtnBackID      uuid.UUID
}

// CRUDAppInput describes a connector-backed List + Edit CRUD layout.
type CRUDAppInput struct {
	TenantID           uuid.UUID
	ApplicationID      uuid.UUID
	DataSourceName     string
	Template           Template
	Columns            []string
	Names              *CRUDAppNames
	FixedIDs           *CRUDAppFixedIDs
	ListOnVisible      *string
	FormDefaultFormula string
	UpsertDB           *gorm.DB
}

// CreateCRUDApp adds List + Edit screens with gallery/datatable + form wired to a datasource name.
func CreateCRUDApp(ctx context.Context, sess repositories.TenantSession, input CRUDAppInput) error {
	if input.DataSourceName == "" {
		return fmt.Errorf("scaffold: data source name is required")
	}
	if input.Template == "" {
		input.Template = TemplateGalleryForm
	}

	source := sanitizeName(input.DataSourceName)
	listName := source + "List"
	editName := source + "Edit"
	listControl := "gallery" + source
	if input.Template == TemplateDataTableForm {
		listControl = "datatable" + source
	}
	formName := "form" + source
	galleryLabel := "lbl" + listControl + "Name"

	if input.Names != nil {
		if input.Names.ListScreen != "" {
			listName = input.Names.ListScreen
		}
		if input.Names.EditScreen != "" {
			editName = input.Names.EditScreen
		}
		if input.Names.ListControl != "" {
			listControl = input.Names.ListControl
		}
		if input.Names.GalleryLabel != "" {
			galleryLabel = input.Names.GalleryLabel
		}
		if input.Names.Form != "" {
			formName = input.Names.Form
		}
	}

	screens, err := sess.Screens().ListByTenant(ctx, input.TenantID, 200, 0)
	if err == nil {
		for _, sc := range screens {
			if sc.ApplicationID == input.ApplicationID && strings.EqualFold(sc.Name, "Screen1") {
				_ = sess.Screens().Delete(ctx, sc.ID)
			}
		}
	}

	listScreen := &models.Screen{
		TenantID:      input.TenantID,
		ApplicationID: input.ApplicationID,
		Name:          listName,
		DisplayOrder:  0,
		LayoutType:    "responsive",
		OnVisible:     input.ListOnVisible,
	}
	editScreen := &models.Screen{
		TenantID:      input.TenantID,
		ApplicationID: input.ApplicationID,
		Name:          editName,
		DisplayOrder:  1,
		LayoutType:    "responsive",
	}
	if input.FixedIDs != nil {
		if input.FixedIDs.ListScreenID != uuid.Nil {
			listScreen.ID = input.FixedIDs.ListScreenID
		}
		if input.FixedIDs.EditScreenID != uuid.Nil {
			editScreen.ID = input.FixedIDs.EditScreenID
		}
	}

	if err := persistScreen(ctx, sess, input.UpsertDB, listScreen); err != nil {
		return fmt.Errorf("scaffold: create list screen: %w", err)
	}
	if err := persistScreen(ctx, sess, input.UpsertDB, editScreen); err != nil {
		return fmt.Errorf("scaffold: create edit screen: %w", err)
	}

	listType := "gallery"
	if input.Template == TemplateDataTableForm {
		listType = "datatable"
	}

	btnNewName := "btnNew" + source
	btnEditName := "btnEdit" + source
	btnSubmitName := "btnSubmit" + source
	btnResetName := "btnReset" + source
	btnDeleteName := "btnDelete" + source
	btnBackName := "btnBack" + source
	if input.Names != nil {
		if input.Names.BtnNew != "" {
			btnNewName = input.Names.BtnNew
		}
		if input.Names.BtnEdit != "" {
			btnEditName = input.Names.BtnEdit
		}
		if input.Names.BtnSubmit != "" {
			btnSubmitName = input.Names.BtnSubmit
		}
		if input.Names.BtnReset != "" {
			btnResetName = input.Names.BtnReset
		}
		if input.Names.BtnBack != "" {
			btnBackName = input.Names.BtnBack
		}
	}

	galleryID := uuid.New()
	galleryNameLblID := uuid.New()
	btnNewID := uuid.New()
	btnEditID := uuid.New()
	formID := uuid.New()
	btnSubmitID := uuid.New()
	btnResetID := uuid.New()
	btnDeleteID := uuid.New()
	btnBackID := uuid.New()
	if input.FixedIDs != nil {
		if input.FixedIDs.GalleryID != uuid.Nil {
			galleryID = input.FixedIDs.GalleryID
		}
		if input.FixedIDs.GalleryLabelID != uuid.Nil {
			galleryNameLblID = input.FixedIDs.GalleryLabelID
		}
		if input.FixedIDs.BtnNewID != uuid.Nil {
			btnNewID = input.FixedIDs.BtnNewID
		}
		if input.FixedIDs.BtnEditID != uuid.Nil {
			btnEditID = input.FixedIDs.BtnEditID
		}
		if input.FixedIDs.FormID != uuid.Nil {
			formID = input.FixedIDs.FormID
		}
		if input.FixedIDs.BtnSubmitID != uuid.Nil {
			btnSubmitID = input.FixedIDs.BtnSubmitID
		}
		if input.FixedIDs.BtnResetID != uuid.Nil {
			btnResetID = input.FixedIDs.BtnResetID
		}
		if input.FixedIDs.BtnBackID != uuid.Nil {
			btnBackID = input.FixedIDs.BtnBackID
		}
	}

	galleryY := float64(24)
	btnNewY := float64(24)
	btnEditY := float64(72)
	btnActionY := float64(400)
	if input.FixedIDs != nil && input.FixedIDs.GalleryID != uuid.Nil {
		galleryY = 120
		btnNewY = 64
		btnEditY = 112
		btnActionY = 448
	}

	controls := []models.Control{
		{TenantID: input.TenantID, ID: galleryID, ScreenID: listScreen.ID, ControlType: listType, Name: listControl, X: 24, Y: galleryY, Width: 520, Height: 280, ZIndex: 3},
		{TenantID: input.TenantID, ID: galleryNameLblID, ScreenID: listScreen.ID, ParentControlID: &galleryID, ControlType: "label", Name: galleryLabel, X: 8, Y: 8, Width: 240, Height: 28, ZIndex: 1},
		{TenantID: input.TenantID, ID: btnNewID, ScreenID: listScreen.ID, ControlType: "button", Name: btnNewName, X: 560, Y: btnNewY, Width: 120, Height: 40, ZIndex: 4},
		{TenantID: input.TenantID, ID: btnEditID, ScreenID: listScreen.ID, ControlType: "button", Name: btnEditName, X: 560, Y: btnEditY, Width: 120, Height: 40, ZIndex: 5},
		{TenantID: input.TenantID, ID: formID, ScreenID: editScreen.ID, ControlType: "form", Name: formName, X: 24, Y: 24, Width: 520, Height: 360, ZIndex: 1},
		{TenantID: input.TenantID, ID: btnSubmitID, ScreenID: editScreen.ID, ControlType: "button", Name: btnSubmitName, X: 24, Y: btnActionY, Width: 120, Height: 40, ZIndex: 3},
		{TenantID: input.TenantID, ID: btnResetID, ScreenID: editScreen.ID, ControlType: "button", Name: btnResetName, X: 160, Y: btnActionY, Width: 120, Height: 40, ZIndex: 4},
		{TenantID: input.TenantID, ID: btnBackID, ScreenID: editScreen.ID, ControlType: "button", Name: btnBackName, X: 432, Y: btnActionY, Width: 120, Height: 40, ZIndex: 6},
	}
	// Skip Delete on seeded layouts (FixedIDs) so customer seed Cancel button is preserved.
	includeDelete := input.FixedIDs == nil || input.FixedIDs.GalleryID == uuid.Nil
	if includeDelete {
		controls = append(controls, models.Control{
			TenantID: input.TenantID, ID: btnDeleteID, ScreenID: editScreen.ID, ControlType: "button", Name: btnDeleteName,
			X: 296, Y: btnActionY, Width: 120, Height: 40, ZIndex: 5,
		})
	}

	for _, c := range controls {
		if err := persistControl(ctx, sess, input.UpsertDB, &c); err != nil {
			return fmt.Errorf("scaffold: create control %s: %w", c.Name, err)
		}
	}

	if input.UpsertDB != nil {
		controlIDs := []uuid.UUID{galleryID, galleryNameLblID, btnNewID, btnEditID, formID, btnSubmitID, btnResetID, btnBackID}
		if includeDelete {
			controlIDs = append(controlIDs, btnDeleteID)
		}
		if err := input.UpsertDB.Where("control_id IN ?", controlIDs).Delete(&models.ControlProperty{}).Error; err != nil {
			return fmt.Errorf("scaffold: reset properties: %w", err)
		}
	}

	firstCol := "Name"
	if len(input.Columns) > 0 {
		firstCol = input.Columns[0]
	}

	props := []struct {
		controlID uuid.UUID
		name      string
		value     interface{}
	}{
		{btnNewID, "text", map[string]string{"value": "New"}},
		{btnEditID, "text", map[string]string{"value": "Edit"}},
		{btnSubmitID, "text", map[string]string{"value": "Submit"}},
		{btnResetID, "text", map[string]string{"value": "Reset"}},
		{btnBackID, "text", map[string]string{"value": "Back"}},
		{formID, "dataSource", map[string]string{"value": input.DataSourceName}},
		{formID, "mode", map[string]string{"kind": "enum", "value": "View"}},
		{galleryID, "items", map[string]string{"formula": input.DataSourceName}},
		{galleryNameLblID, "text", map[string]string{"formula": "ThisItem." + firstCol}},
		{formID, "item", map[string]string{"formula": listControl + ".Selected"}},
		{btnNewID, "onSelect", map[string]string{"formula": fmt.Sprintf("NewForm(%s); Navigate(%s)", formName, editName)}},
		{btnEditID, "onSelect", map[string]string{"formula": fmt.Sprintf("EditForm(%s); Navigate(%s)", formName, editName)}},
		{btnSubmitID, "onSelect", map[string]string{"formula": fmt.Sprintf("SubmitForm(%s); Navigate(%s)", formName, listName)}},
		{btnResetID, "onSelect", map[string]string{"formula": fmt.Sprintf("ResetForm(%s)", formName)}},
		{btnBackID, "onSelect", map[string]string{"formula": "Back()"}},
	}
	if includeDelete {
		props = append(props,
			struct {
				controlID uuid.UUID
				name      string
				value     interface{}
			}{btnDeleteID, "text", map[string]string{"value": "Delete"}},
			struct {
				controlID uuid.UUID
				name      string
				value     interface{}
			}{btnDeleteID, "onSelect", map[string]string{"formula": fmt.Sprintf("Remove(%s, %s.Item); Navigate(%s)", input.DataSourceName, formName, listName)}},
		)
	}
	if input.FormDefaultFormula != "" {
		props = append(props, struct {
			controlID uuid.UUID
			name      string
			value     interface{}
		}{formID, "default", map[string]string{"formula": input.FormDefaultFormula}})
	}

	for _, p := range props {
		if err := createProperty(ctx, sess, input.UpsertDB, input.TenantID, p.controlID, p.name, p.value); err != nil {
			return err
		}
	}

	y := float64(16)
	for _, col := range input.Columns {
		col = strings.TrimSpace(col)
		if col == "" {
			continue
		}
		cardID := uuid.New()
		lblID := uuid.New()
		inputID := uuid.New()
		fieldName := sanitizeName(col)
		card := models.Control{
			TenantID: input.TenantID, ID: cardID, ScreenID: editScreen.ID, ParentControlID: &formID,
			ControlType: "datacard", Name: "card" + fieldName, X: 16, Y: y, Width: 488, Height: 56, ZIndex: 1,
		}
		lbl := models.Control{
			TenantID: input.TenantID, ID: lblID, ScreenID: editScreen.ID, ParentControlID: &cardID,
			ControlType: "label", Name: "lbl" + fieldName, X: 0, Y: 0, Width: 488, Height: 20, ZIndex: 1,
		}
		inp := models.Control{
			TenantID: input.TenantID, ID: inputID, ScreenID: editScreen.ID, ParentControlID: &cardID,
			ControlType: "textinput", Name: "txt" + fieldName, X: 0, Y: 24, Width: 488, Height: 32, ZIndex: 2,
		}
		if err := persistControl(ctx, sess, input.UpsertDB, &card); err != nil {
			return err
		}
		if err := persistControl(ctx, sess, input.UpsertDB, &lbl); err != nil {
			return err
		}
		if err := persistControl(ctx, sess, input.UpsertDB, &inp); err != nil {
			return err
		}
		if err := createProperty(ctx, sess, input.UpsertDB, input.TenantID, cardID, "dataField", map[string]string{"value": col}); err != nil {
			return err
		}
		if err := createProperty(ctx, sess, input.UpsertDB, input.TenantID, cardID, "default", map[string]string{"formula": "ThisItem." + col}); err != nil {
			return err
		}
		if err := createProperty(ctx, sess, input.UpsertDB, input.TenantID, cardID, "required", map[string]string{"value": "false"}); err != nil {
			return err
		}
		if err := createProperty(ctx, sess, input.UpsertDB, input.TenantID, cardID, "displayMode", map[string]string{"value": "Edit"}); err != nil {
			return err
		}
		if err := createProperty(ctx, sess, input.UpsertDB, input.TenantID, cardID, "visible", map[string]string{"value": "true"}); err != nil {
			return err
		}
		if err := createProperty(ctx, sess, input.UpsertDB, input.TenantID, lblID, "text", map[string]string{"value": col}); err != nil {
			return err
		}
		if err := createProperty(ctx, sess, input.UpsertDB, input.TenantID, inputID, "default", map[string]string{"formula": "ThisItem." + col}); err != nil {
			return err
		}
		y += 56
	}

	return nil
}

func persistScreen(ctx context.Context, sess repositories.TenantSession, upsertDB *gorm.DB, screen *models.Screen) error {
	if upsertDB != nil {
		return upsertEntity(upsertDB, screen, []string{"name", "display_order", "layout_type", "on_visible", "modified_on"})
	}
	return sess.Screens().Create(ctx, screen)
}

func persistControl(ctx context.Context, sess repositories.TenantSession, upsertDB *gorm.DB, control *models.Control) error {
	if upsertDB != nil {
		return upsertEntity(upsertDB, control, []string{"screen_id", "parent_control_id", "control_type", "name", "x", "y", "width", "height", "z_index", "modified_on"})
	}
	return sess.Controls().Create(ctx, control)
}

func createProperty(ctx context.Context, sess repositories.TenantSession, upsertDB *gorm.DB, tenantID, controlID uuid.UUID, name string, value interface{}) error {
	b, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("scaffold: marshal property %s: %w", name, err)
	}
	cp := &models.ControlProperty{
		TenantID:      tenantID,
		ControlID:     controlID,
		PropertyName:  name,
		PropertyValue: datatypes.JSON(b),
	}
	if upsertDB != nil {
		if err := upsertDB.Create(cp).Error; err != nil {
			return fmt.Errorf("scaffold: create property %s: %w", name, err)
		}
		return nil
	}
	if err := sess.ControlProperties().Create(ctx, cp); err != nil {
		return fmt.Errorf("scaffold: create property %s: %w", name, err)
	}
	return nil
}

func upsertEntity(tx *gorm.DB, entity interface{}, updateColumns []string) error {
	if err := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns(updateColumns),
	}).Create(entity).Error; err != nil {
		return fmt.Errorf("scaffold: upsert: %w", err)
	}
	return nil
}

func sanitizeName(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return "Data"
	}
	var b strings.Builder
	for i, r := range s {
		if i == 0 && r >= 'a' && r <= 'z' {
			b.WriteRune(r - ('a' - 'A'))
			continue
		}
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	out := b.String()
	if out == "" {
		return "Data"
	}
	return out
}
