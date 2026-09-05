package services

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/goapps-platform/metadata-service/internal/api/contracts"
	"github.com/goapps-platform/metadata-service/internal/models"
	"github.com/google/uuid"
)

// Assemble runtime DTOs from models
func assembleRuntimeApplication(app *models.Application, screens []models.Screen, controls []models.Control, props []models.ControlProperty, formulas []models.Formula, componentDefs []models.ComponentDefinition, entities []models.Entity, entityFields []models.EntityField, connectors []models.Connector, connectorActions []models.ConnectorAction) (*contracts.RuntimeApplication, error) {
	if app == nil {
		return nil, fmt.Errorf("assemble runtime application: nil application")
	}
	ram := &contracts.RuntimeApplication{
		ID:        app.ID,
		TenantID:  app.TenantID,
		Name:      app.Name,
		Status:    app.Status,
		OnStart:   app.OnStart,
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

	// build screens in display_order so screens[0] is the app start screen
	sortedScreens := append([]models.Screen(nil), screens...)
	sort.SliceStable(sortedScreens, func(i, j int) bool {
		if sortedScreens[i].DisplayOrder != sortedScreens[j].DisplayOrder {
			return sortedScreens[i].DisplayOrder < sortedScreens[j].DisplayOrder
		}
		return sortedScreens[i].Name < sortedScreens[j].Name
	})
	for _, s := range sortedScreens {
		rs := contracts.RuntimeScreen{ID: s.ID, ApplicationID: s.ApplicationID, Name: s.Name, DisplayOrder: s.DisplayOrder, LayoutType: s.LayoutType, OnVisible: s.OnVisible}
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
			rc.Formulas = promoteActionFormulasFromProperties(c.ID, rc.Properties, rc.Formulas)
			runtimeCtrls = append(runtimeCtrls, rc)
		}
		expandedCtrls, err := expandComponentInstances(runtimeCtrls, componentDefs)
		if err != nil {
			return nil, fmt.Errorf("assemble runtime application: expand components for screen %s: %w", s.ID.String(), err)
		}
		// build tree
		runtimeTree, err := buildControlTree(expandedCtrls)
		if err != nil {
			return nil, fmt.Errorf("assemble runtime application: build control tree for screen %s: %w", s.ID.String(), err)
		}
		rs.Controls = runtimeTree
		ram.Screens = append(ram.Screens, rs)
	}

	ram.Entities = assembleRuntimeEntities(entities, entityFields)
	ram.Connectors = assembleRuntimeConnectors(connectors, connectorActions)

	return ram, nil
}

func assembleRuntimeEntities(entities []models.Entity, fields []models.EntityField) []contracts.RuntimeEntity {
	fieldsByEntity := map[string][]models.EntityField{}
	for _, f := range fields {
		eid := f.EntityID.String()
		fieldsByEntity[eid] = append(fieldsByEntity[eid], f)
	}
	out := make([]contracts.RuntimeEntity, 0, len(entities))
	for _, e := range entities {
		re := contracts.RuntimeEntity{Name: e.Name, Fields: []contracts.RuntimeEntityField{}}
		for _, f := range fieldsByEntity[e.ID.String()] {
			re.Fields = append(re.Fields, contracts.RuntimeEntityField{Name: f.Name, FieldType: f.FieldType})
		}
		out = append(out, re)
	}
	return out
}

// assembleRuntimeConnectors freezes connectors + actions into the runtime
// package. auth_config is sanitized via redactAuthConfig so publish snapshots
// (Phase 7.13) never carry plaintext secrets, only secret_id references.
func assembleRuntimeConnectors(connectors []models.Connector, actions []models.ConnectorAction) []contracts.RuntimeConnector {
	actionsByConnector := map[string][]models.ConnectorAction{}
	for _, a := range actions {
		actionsByConnector[a.ConnectorID.String()] = append(actionsByConnector[a.ConnectorID.String()], a)
	}
	out := make([]contracts.RuntimeConnector, 0, len(connectors))
	for _, c := range connectors {
		authJSON, _ := redactAuthConfig(c.AuthConfig)
		rc := contracts.RuntimeConnector{
			ID:                 c.ID,
			Name:               c.Name,
			ConnectorType:      c.ConnectorType,
			AuthenticationType: c.AuthenticationType,
			BaseURL:            c.BaseURL,
			AuthConfig:         authJSON,
		}
		for _, a := range actionsByConnector[c.ID.String()] {
			rc.Actions = append(rc.Actions, contracts.RuntimeConnectorAction{ActionName: a.ActionName, HTTPMethod: a.HTTPMethod, Endpoint: a.Endpoint})
		}
		out = append(out, rc)
	}
	return out
}

// promoteActionFormulasFromProperties copies action property wrappers
// ({"formula":"..."}) into Formulas when the formulas table has no row for that property.
func promoteActionFormulasFromProperties(
	controlID uuid.UUID,
	properties map[string]interface{},
	existing []contracts.RuntimeFormula,
) []contracts.RuntimeFormula {
	if len(properties) == 0 {
		return existing
	}
	covered := map[string]struct{}{}
	for _, f := range existing {
		covered[strings.ToLower(strings.TrimSpace(f.PropertyName))] = struct{}{}
	}
	out := append([]contracts.RuntimeFormula(nil), existing...)
	for name, raw := range properties {
		if !isActionFormulaProperty(name) {
			continue
		}
		key := strings.ToLower(strings.TrimSpace(name))
		if _, ok := covered[key]; ok {
			continue
		}
		text := extractPropertyFormulaText(raw)
		if text == "" {
			continue
		}
		out = append(out, contracts.RuntimeFormula{
			ControlID:    controlID,
			PropertyName: name,
			FormulaText:  text,
			FormulaType:  "action",
		})
		covered[key] = struct{}{}
	}
	return out
}

func isActionFormulaProperty(name string) bool {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "onselect", "onchange", "ontimerend", "onsuccess", "onfailure":
		return true
	default:
		return false
	}
}

func extractPropertyFormulaText(raw interface{}) string {
	switch typed := raw.(type) {
	case string:
		return strings.TrimSpace(typed)
	case map[string]interface{}:
		if formula, ok := typed["formula"].(string); ok {
			return strings.TrimSpace(formula)
		}
	}
	return ""
}
