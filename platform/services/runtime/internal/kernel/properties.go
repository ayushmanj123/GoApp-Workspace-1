package kernel

import (
	"context"
	"errors"
	"strings"

	"github.com/goapps-platform/runtime-service/internal/formula"
	"github.com/goapps-platform/runtime-service/internal/properties"
	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/google/uuid"
)

type propertySessionAdapter struct {
	kernel *RuntimeKernel
}

func (k *RuntimeKernel) PropertySessionAdapter() properties.SessionLookup {
	return &propertySessionAdapter{kernel: k}
}

func (a *propertySessionAdapter) PropertySession(sessionID uuid.UUID) (uuid.UUID, properties.SessionAccess, error) {
	session, ok := a.kernel.sessions.Get(sessionID)
	if !ok || session.Package == nil {
		return uuid.Nil, nil, ErrSessionNotFound
	}
	return sessionID, &propertySessionAccess{kernel: a.kernel, session: session}, nil
}

type propertySessionAccess struct {
	kernel  *RuntimeKernel
	session *RuntimeSession
}

func (a *propertySessionAccess) FormulaContext() any {
	if a == nil || a.session == nil || a.kernel == nil {
		return nil
	}
	return a.kernel.buildFormulaContext(context.Background(), a.session, a.session.CurrentScreen)
}

func (a *propertySessionAccess) Control(controlID string) (properties.ControlDefinition, bool) {
	if a == nil || a.session == nil || a.session.Package == nil {
		return properties.ControlDefinition{}, false
	}
	control, ok := a.session.Package.Controls[strings.ToLower(strings.TrimSpace(controlID))]
	if !ok {
		for _, item := range uniqueControls(a.session.Package) {
			if strings.EqualFold(item.ID.String(), controlID) {
				control = item
				ok = true
				break
			}
		}
	}
	if !ok {
		return properties.ControlDefinition{}, false
	}
	return toPropertyControl(control), true
}

func (a *propertySessionAccess) ControlsOnScreen(screenID string) []properties.ControlDefinition {
	if a == nil || a.session == nil || a.session.Package == nil {
		return nil
	}
	screenID = strings.TrimSpace(screenID)
	controls := make([]properties.ControlDefinition, 0)
	for _, control := range uniqueControls(a.session.Package) {
		if screenID != "" &&
			!strings.EqualFold(control.Screen, screenID) &&
			!strings.EqualFold(control.ScreenID.String(), screenID) {
			continue
		}
		controls = append(controls, toPropertyControl(control))
	}
	return controls
}

func (a *propertySessionAccess) AllControls() []properties.ControlDefinition {
	return a.ControlsOnScreen("")
}

func toPropertyControl(control RuntimeControl) properties.ControlDefinition {
	formulas := make([]properties.FormulaBinding, 0, len(control.Formulas))
	for _, item := range control.Formulas {
		formulas = append(formulas, properties.FormulaBinding{
			PropertyName: item.PropertyName,
			FormulaText:  item.FormulaText,
			FormulaType:  item.FormulaType,
		})
	}
	return properties.ControlDefinition{
		ID:          control.ID,
		Name:        control.Name,
		ControlType: control.ControlType,
		ScreenID:    control.ScreenID,
		Screen:      control.Screen,
		X:           control.X,
		Y:           control.Y,
		Width:       control.Width,
		Height:      control.Height,
		Formulas:    formulas,
		Properties:  control.Properties,
	}
}

func propertyControlsForPackage(pkg *Package) []properties.ControlDefinition {
	controls := make([]properties.ControlDefinition, 0)
	for _, control := range uniqueControls(pkg) {
		controls = append(controls, toPropertyControl(control))
	}
	return controls
}

func (k *RuntimeKernel) registerPropertyDependencies(session *RuntimeSession) {
	if k == nil || k.registry == nil || k.registry.Properties == nil || session == nil || session.Package == nil {
		return
	}
	controls := propertyControlsForPackage(session.Package)
	k.registry.Properties.RegisterDependencies(session.ID, controls)
	formulaDeps := properties.MergeControlDependencies(controls)
	staticDeps := buildDependencies(session.Package)
	session.Dependencies = mergeReactiveDependencies(formulaDeps, staticDeps)
	if k.registry.Reactive != nil {
		k.registry.Reactive.RegisterDependencies(session.ID, session.Dependencies)
	}
}

func (k *RuntimeKernel) invalidatePropertyCache(sessionID uuid.UUID, refresh []reactive.RefreshInstruction) {
	if k == nil || k.registry == nil || k.registry.Properties == nil {
		return
	}
	seen := map[string]struct{}{}
	for _, item := range refresh {
		if item.ControlID == "" {
			continue
		}
		if _, ok := seen[item.ControlID]; ok {
			continue
		}
		seen[item.ControlID] = struct{}{}
		k.registry.Properties.InvalidateControl(sessionID, item.ControlID)
	}
	k.invalidateRendererCache(sessionID, refresh)
}

func (k *RuntimeKernel) invalidatePropertyEvent(sessionID uuid.UUID, event reactive.Event) {
	if k == nil || k.registry == nil || k.registry.Properties == nil {
		return
	}
	k.registry.Properties.InvalidateEvent(sessionID, event)
	k.invalidateRendererEvent(sessionID, event)
}

// formulaEvaluatorAdapter bridges the kernel formula runtime to the property engine.
type formulaEvaluatorAdapter struct {
	kernel *RuntimeKernel
}

func NewFormulaEvaluatorAdapter(kernel *RuntimeKernel) properties.FormulaEvaluator {
	return formulaEvaluatorAdapter{kernel: kernel}
}

func (a formulaEvaluatorAdapter) Evaluate(rtCtx any, formulaText string) (any, error) {
	ctx, ok := rtCtx.(*formula.RuntimeFormulaContext)
	if !ok || a.kernel == nil || a.kernel.registry == nil {
		return nil, errors.New("formula context is unavailable")
	}
	return a.kernel.registry.Formula.Evaluate(ctx, formulaText)
}
