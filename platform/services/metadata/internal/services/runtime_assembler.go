package services

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/goapps-platform/metadata-service/internal/api/contracts"
	"github.com/goapps-platform/metadata-service/internal/models"
)

// Assemble runtime DTOs from models
func assembleRuntimeApplication(app *models.Application, screens []models.Screen, controls []models.Control, props []models.ControlProperty, formulas []models.Formula) (*contracts.RuntimeApplication, error) {
	if app == nil {
		return nil, fmt.Errorf("assemble runtime application: nil application")
	}
	ram := &contracts.RuntimeApplication{
		ID:        app.ID,
		TenantID:  app.TenantID,
		Name:      app.Name,
		Status:    app.Status,
		Screens:   []contracts.RuntimeScreen{},
		CreatedOn: app.CreatedOn,
	}

	// index properties by control id
	propMap := map[string]map[string]interface{}{}
	for _, p := range props {
		cid := p.ControlID.String()
		if _, ok := propMap[cid]; !ok {
			propMap[cid] = map[string]interface{}{}
		}
		var v interface{}
		if err := json.Unmarshal(p.PropertyValue, &v); err != nil {
			return nil, fmt.Errorf("assemble runtime application: invalid property value for control %s property %s: %w", cid, p.PropertyName, err)
		}
		propMap[cid][p.PropertyName] = v
	}

	// index formulas by control id
	formulaMap := map[string][]contracts.RuntimeFormula{}
	for _, f := range formulas {
		if strings.TrimSpace(f.PropertyName) == "" || strings.TrimSpace(f.FormulaText) == "" || strings.TrimSpace(f.FormulaType) == "" {
			return nil, fmt.Errorf("assemble runtime application: invalid formula %s", f.ID.String())
		}
		cf := contracts.RuntimeFormula{ID: f.ID, ControlID: f.ControlID, PropertyName: f.PropertyName, FormulaText: f.FormulaText, FormulaType: f.FormulaType}
		formulaMap[f.ControlID.String()] = append(formulaMap[f.ControlID.String()], cf)
	}

	// group controls by screen
	controlsByScreen := map[string][]models.Control{}
	for _, c := range controls {
		controlsByScreen[c.ScreenID.String()] = append(controlsByScreen[c.ScreenID.String()], c)
	}

	// build screens
	for _, s := range screens {
		rs := contracts.RuntimeScreen{ID: s.ID, ApplicationID: s.ApplicationID, Name: s.Name, DisplayOrder: s.DisplayOrder, LayoutType: s.LayoutType}
		// build controls for this screen
		ctrls := controlsByScreen[s.ID.String()]
		// convert to runtime controls
		runtimeCtrls := []contracts.RuntimeControl{}
		for _, c := range ctrls {
			if strings.TrimSpace(c.ControlType) == "" {
				return nil, fmt.Errorf("assemble runtime application: control %s has empty control_type", c.ID.String())
			}
			rc := contracts.RuntimeControl{ID: c.ID, ScreenID: c.ScreenID, ParentControlID: c.ParentControlID, ControlType: c.ControlType, Name: c.Name, X: c.X, Y: c.Y, Width: c.Width, Height: c.Height, ZIndex: c.ZIndex}
			if p, ok := propMap[c.ID.String()]; ok {
				rc.Properties = p
			}
			if f, ok := formulaMap[c.ID.String()]; ok {
				rc.Formulas = f
			}
			runtimeCtrls = append(runtimeCtrls, rc)
		}
		// build tree
		runtimeTree, err := buildControlTree(runtimeCtrls)
		if err != nil {
			return nil, fmt.Errorf("assemble runtime application: build control tree for screen %s: %w", s.ID.String(), err)
		}
		rs.Controls = runtimeTree
		ram.Screens = append(ram.Screens, rs)
	}

	return ram, nil
}
