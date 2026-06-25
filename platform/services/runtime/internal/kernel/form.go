package kernel

import (
	"context"
	"strings"

	"github.com/goapps-platform/runtime-service/internal/form"
	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/google/uuid"
)

type formSessionAdapter struct {
	kernel *RuntimeKernel
}

func (a *formSessionAdapter) FormControl(sessionID uuid.UUID, controlID string) (form.ControlMetadata, uuid.UUID, uuid.UUID, uuid.UUID, error) {
	session, control, err := a.kernel.formControl(sessionID, controlID)
	if err != nil {
		return form.ControlMetadata{}, uuid.Nil, uuid.Nil, uuid.Nil, err
	}
	return toFormControl(session, control), session.TenantID, session.UserID, session.AppID, nil
}

func (k *RuntimeKernel) FormSessionAdapter() form.SessionLookup {
	return &formSessionAdapter{kernel: k}
}

func (k *RuntimeKernel) formControl(sessionID uuid.UUID, controlID string) (*RuntimeSession, RuntimeControl, error) {
	session, ok := k.sessions.Get(sessionID)
	if !ok || session.Package == nil {
		return nil, RuntimeControl{}, ErrSessionNotFound
	}
	control, ok := session.Package.Controls[strings.ToLower(strings.TrimSpace(controlID))]
	if !ok {
		return nil, RuntimeControl{}, ErrControlNotFound
	}
	if !form.IsFormControl(control.ControlType) {
		return nil, RuntimeControl{}, ErrControlNotFound
	}
	return session, control, nil
}

func (k *RuntimeKernel) loadScreenForms(ctx context.Context, session *RuntimeSession, screenName string) error {
	if k == nil || k.registry == nil || k.registry.Form == nil || session == nil || session.Package == nil {
		return nil
	}
	screenName = strings.TrimSpace(screenName)
	for _, control := range uniqueControls(session.Package) {
		if !form.IsFormControl(control.ControlType) {
			continue
		}
		if screenName != "" && !strings.EqualFold(control.Screen, screenName) {
			continue
		}
		if _, err := k.registry.Form.Load(ctx, session.ID, session.TenantID, session.UserID, session.AppID, toFormControl(session, control)); err != nil {
			return err
		}
	}
	return nil
}

func (k *RuntimeKernel) syncFormsFromGallery(session *RuntimeSession, galleryName string) []reactive.RefreshInstruction {
	if k == nil || k.registry == nil || k.registry.Form == nil || session == nil || session.Package == nil {
		return nil
	}
	updated := k.registry.Form.SyncGallerySelection(session.ID, galleryName, formControlsForPackage(session.Package))
	refresh := make([]reactive.RefreshInstruction, 0)
	if k.registry.Reactive == nil {
		return refresh
	}
	for _, formName := range updated {
		resp := k.registry.Reactive.Notifier.FormChanged(session.ID, session.AppID, formName)
		refresh = reactive.MergeRefresh(reactive.RefreshResponse{Refresh: refresh}, resp)
	}
	return refresh
}

func toFormControl(session *RuntimeSession, control RuntimeControl) form.ControlMetadata {
	formulas := make([]form.FormulaBinding, 0, len(control.Formulas))
	for _, item := range control.Formulas {
		formulas = append(formulas, form.FormulaBinding{
			PropertyName: item.PropertyName,
			FormulaText:  item.FormulaText,
		})
	}
	entities := []string{}
	if session != nil && session.Package != nil {
		entities = append(entities, session.Package.Entities...)
	}
	return form.ControlMetadata{
		Name:        control.Name,
		ControlType: control.ControlType,
		Screen:      control.Screen,
		Formulas:    formulas,
		Properties:  control.Properties,
		EntityNames: entities,
	}
}

func formControlsForPackage(pkg *Package) []form.ControlMetadata {
	controls := make([]form.ControlMetadata, 0)
	for _, control := range uniqueControls(pkg) {
		if !form.IsFormControl(control.ControlType) {
			continue
		}
		controls = append(controls, toFormControl(&RuntimeSession{Package: pkg}, control))
	}
	return controls
}

type kernelFormActions struct {
	ctx     context.Context
	kernel  *RuntimeKernel
	session *RuntimeSession
}

func (a *kernelFormActions) SubmitForm(formName string) (string, error) {
	if a == nil || a.kernel == nil || a.kernel.registry == nil || a.kernel.registry.Form == nil || a.session == nil {
		return "", form.ErrFormNotFound
	}
	control, ok := findFormControl(a.session.Package, formName)
	if !ok {
		return "", form.ErrFormNotFound
	}
	_, dataSource, err := a.kernel.registry.Form.Submit(a.ctx, a.session.ID, a.session.TenantID, a.session.UserID, a.session.AppID, toFormControl(a.session, control))
	return dataSource, err
}

func (a *kernelFormActions) ResetForm(formName string) error {
	if a == nil || a.kernel == nil || a.kernel.registry == nil || a.kernel.registry.Form == nil || a.session == nil {
		return form.ErrFormNotFound
	}
	control, ok := findFormControl(a.session.Package, formName)
	if !ok {
		return form.ErrFormNotFound
	}
	_, err := a.kernel.registry.Form.Reset(a.ctx, a.session.ID, a.session.TenantID, a.session.AppID, toFormControl(a.session, control))
	return err
}

func (a *kernelFormActions) SetFormMode(formName, mode string) error {
	if a == nil || a.kernel == nil || a.kernel.registry == nil || a.kernel.registry.Form == nil || a.session == nil {
		return form.ErrFormNotFound
	}
	control, ok := findFormControl(a.session.Package, formName)
	if !ok {
		return form.ErrFormNotFound
	}
	_, err := a.kernel.registry.Form.SetMode(a.ctx, a.session.ID, a.session.TenantID, a.session.AppID, toFormControl(a.session, control), form.Mode(mode))
	return err
}

func findFormControl(pkg *Package, formName string) (RuntimeControl, bool) {
	if pkg == nil {
		return RuntimeControl{}, false
	}
	control, ok := pkg.Controls[strings.ToLower(strings.TrimSpace(formName))]
	if !ok || !form.IsFormControl(control.ControlType) {
		return RuntimeControl{}, false
	}
	return control, true
}

var ErrFormNotFound = form.ErrFormNotFound
