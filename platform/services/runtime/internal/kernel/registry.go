package kernel

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/goapps-platform/runtime-service/internal/databinding"
	"github.com/goapps-platform/runtime-service/internal/formula"
	"github.com/goapps-platform/runtime-service/internal/form"
	"github.com/goapps-platform/runtime-service/internal/gallery"
	"github.com/goapps-platform/runtime-service/internal/properties"
	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/goapps-platform/runtime-service/internal/renderer"
	"github.com/goapps-platform/runtime-service/internal/state"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrSessionNotFound = errors.New("runtime session not found")
	ErrControlNotFound = errors.New("control not found")
	ErrFormulaNotFound = errors.New("formula not found")
	ErrMetadataMissing = errors.New("metadata loader is not configured")
)

// Registry holds runtime service dependencies accessed only through the kernel.
type Registry struct {
	State       *state.MemoryStore
	Reactive    *reactive.Engine
	Formula     *formula.Evaluator
	Resolver    formula.BindingResolver
	DataSources *databinding.DataSourceRegistry
	Binding     *databinding.Service
	Gallery     *gallery.Service
	Form         *form.Service
	Properties   *properties.Engine
	Renderer     *renderer.Engine
	Metadata     MetadataLoader
	SessionTTL   time.Duration
	MaxSessions  int
}

// MetadataLoader loads application metadata once per session.
type MetadataLoader interface {
	Load(ctx context.Context, tenantID, appID uuid.UUID, channel string) (*Package, error)
}

// NewRegistry creates a service registry for the runtime kernel.
func NewRegistry(
	stateStore *state.MemoryStore,
	reactiveEngine *reactive.Engine,
	resolver formula.BindingResolver,
	dataSources *databinding.DataSourceRegistry,
	bindingSvc *databinding.Service,
	gallerySvc *gallery.Service,
	formSvc *form.Service,
	propertiesEngine *properties.Engine,
	rendererEngine *renderer.Engine,
	metadata MetadataLoader,
) *Registry {
	return &Registry{
		State:       stateStore,
		Reactive:    reactiveEngine,
		Formula:     formula.NewEvaluator(),
		Resolver:    resolver,
		DataSources: dataSources,
		Binding:     bindingSvc,
		Gallery:     gallerySvc,
		Form:        formSvc,
		Properties:  propertiesEngine,
		Renderer:    rendererEngine,
		Metadata:    metadata,
		SessionTTL:  30 * time.Minute,
	}
}

// PostgresMetadataLoader reads runtime metadata from the shared PostgreSQL database.
type PostgresMetadataLoader struct {
	db *gorm.DB
}

func NewPostgresMetadataLoader(db *gorm.DB) *PostgresMetadataLoader {
	return &PostgresMetadataLoader{db: db}
}

type applicationRow struct {
	ID      uuid.UUID `gorm:"column:id"`
	OnStart *string   `gorm:"column:on_start"`
}

func (applicationRow) TableName() string { return "applications" }

type screenRow struct {
	ID        uuid.UUID `gorm:"column:id"`
	Name      string    `gorm:"column:name"`
	OnVisible *string   `gorm:"column:on_visible"`
}

func (screenRow) TableName() string { return "screens" }

type controlRow struct {
	ID          uuid.UUID `gorm:"column:id"`
	ScreenID    uuid.UUID `gorm:"column:screen_id"`
	Name        string    `gorm:"column:name"`
	ControlType string    `gorm:"column:control_type"`
	X           float64   `gorm:"column:x"`
	Y           float64   `gorm:"column:y"`
	Width       float64   `gorm:"column:width"`
	Height      float64   `gorm:"column:height"`
}

func (controlRow) TableName() string { return "controls" }

type formulaRow struct {
	ControlID    uuid.UUID `gorm:"column:control_id"`
	PropertyName string    `gorm:"column:property_name"`
	FormulaText  string    `gorm:"column:formula_text"`
	FormulaType  string    `gorm:"column:formula_type"`
}

func (formulaRow) TableName() string { return "formulas" }

type propertyRow struct {
	ControlID     uuid.UUID `gorm:"column:control_id"`
	PropertyName  string    `gorm:"column:property_name"`
	PropertyValue []byte    `gorm:"column:property_value"`
}

type entityRow struct {
	Name string `gorm:"column:name"`
}

func (entityRow) TableName() string { return "entities" }

type connectorRow struct {
	Name string `gorm:"column:name"`
}

func (connectorRow) TableName() string { return "connectors" }

func (l *PostgresMetadataLoader) Load(ctx context.Context, tenantID, appID uuid.UUID, channel string) (*Package, error) {
	_ = channel
	if l == nil || l.db == nil {
		return nil, ErrMetadataMissing
	}

	var app applicationRow
	err := l.db.WithContext(ctx).
		Select("id, on_start").
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", appID, tenantID).
		First(&app).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("application not found")
	}
	if err != nil {
		return nil, fmt.Errorf("load application: %w", err)
	}

	var screens []screenRow
	if err := l.db.WithContext(ctx).
		Select("id, name, on_visible").
		Where("application_id = ? AND tenant_id = ? AND deleted_at IS NULL", appID, tenantID).
		Order("display_order ASC").
		Find(&screens).Error; err != nil {
		return nil, fmt.Errorf("load screens: %w", err)
	}

	screenIDs := make([]uuid.UUID, 0, len(screens))
	screenByID := map[uuid.UUID]screenRow{}
	screenByName := map[string]RuntimeScreen{}
	for _, screen := range screens {
		screenIDs = append(screenIDs, screen.ID)
		screenByID[screen.ID] = screen
		screenByName[strings.ToLower(screen.Name)] = RuntimeScreen{
			ID:        screen.ID,
			Name:      screen.Name,
			OnVisible: screen.OnVisible,
		}
	}

	controls := []controlRow{}
	if len(screenIDs) > 0 {
		if err := l.db.WithContext(ctx).
			Select("id, screen_id, name, control_type, x, y, width, height").
			Where("tenant_id = ? AND screen_id IN ? AND deleted_at IS NULL", tenantID, screenIDs).
			Find(&controls).Error; err != nil {
			return nil, fmt.Errorf("load controls: %w", err)
		}
	}

	controlIDs := make([]uuid.UUID, 0, len(controls))
	controlByID := map[uuid.UUID]controlRow{}
	controlByName := map[string]RuntimeControl{}
	for _, control := range controls {
		controlIDs = append(controlIDs, control.ID)
		controlByID[control.ID] = control
		screen := screenByID[control.ScreenID]
		controlByName[strings.ToLower(control.Name)] = RuntimeControl{
			ID:          control.ID,
			Name:        control.Name,
			ControlType: control.ControlType,
			ScreenID:    control.ScreenID,
			Screen:      screen.Name,
			X:           int(control.X),
			Y:           int(control.Y),
			Width:       int(control.Width),
			Height:      int(control.Height),
		}
	}

	formulas := []formulaRow{}
	if len(controlIDs) > 0 {
		if err := l.db.WithContext(ctx).
			Select("control_id, property_name, formula_text, formula_type").
			Where("tenant_id = ? AND control_id IN ?", tenantID, controlIDs).
			Find(&formulas).Error; err != nil {
			return nil, fmt.Errorf("load formulas: %w", err)
		}
	}

	formulaByControl := map[uuid.UUID][]RuntimeFormula{}
	for _, row := range formulas {
		formulaByControl[row.ControlID] = append(formulaByControl[row.ControlID], RuntimeFormula{
			PropertyName: row.PropertyName,
			FormulaText:  row.FormulaText,
			FormulaType:  row.FormulaType,
		})
	}

	properties := []propertyRow{}
	if len(controlIDs) > 0 {
		if err := l.db.WithContext(ctx).
			Table("control_properties").
			Select("control_id, property_name, property_value").
			Where("tenant_id = ? AND control_id IN ?", tenantID, controlIDs).
			Find(&properties).Error; err != nil {
			return nil, fmt.Errorf("load properties: %w", err)
		}
	}

	propsByControl := map[uuid.UUID]map[string]interface{}{}
	for _, row := range properties {
		if propsByControl[row.ControlID] == nil {
			propsByControl[row.ControlID] = map[string]interface{}{}
		}
		var value interface{}
		if err := json.Unmarshal(row.PropertyValue, &value); err != nil {
			return nil, fmt.Errorf("parse property %s: %w", row.PropertyName, err)
		}
		propsByControl[row.ControlID][row.PropertyName] = value
	}

	runtimeScreens := make([]RuntimeScreen, 0, len(screens))
	for _, screen := range screens {
		runtimeScreens = append(runtimeScreens, RuntimeScreen{
			ID:        screen.ID,
			Name:      screen.Name,
			OnVisible: screen.OnVisible,
		})
	}

	for id, control := range controlByID {
		runtimeControl := controlByName[strings.ToLower(control.Name)]
		runtimeControl.Formulas = formulaByControl[id]
		runtimeControl.Properties = propsByControl[id]
		controlByName[strings.ToLower(control.Name)] = runtimeControl
		controlByName[strings.ToLower(id.String())] = runtimeControl
	}

	entities := []entityRow{}
	if err := l.db.WithContext(ctx).
		Select("name").
		Where("tenant_id = ? AND application_id = ? AND deleted_at IS NULL", tenantID, appID).
		Find(&entities).Error; err != nil {
		return nil, fmt.Errorf("load entities: %w", err)
	}
	entityNames := make([]string, 0, len(entities))
	for _, entity := range entities {
		entityNames = append(entityNames, entity.Name)
	}

	connectors := []connectorRow{}
	if err := l.db.WithContext(ctx).
		Select("name").
		Where("tenant_id = ? AND application_id = ? AND connector_type IN ('rest','sql','storage','google_sheets') AND deleted_at IS NULL", tenantID, appID).
		Find(&connectors).Error; err != nil {
		return nil, fmt.Errorf("load connectors: %w", err)
	}
	connectorNames := make([]string, 0, len(connectors))
	for _, connector := range connectors {
		connectorNames = append(connectorNames, connector.Name)
	}

	return &Package{
		AppID:         appID,
		OnStart:       app.OnStart,
		Screens:       runtimeScreens,
		Entities:      entityNames,
		Connectors:    connectorNames,
		Controls:      controlByName,
		ScreensByName: screenByName,
	}, nil
}
