package kernel

import (
	"context"
	"errors"
	"log"
	"strings"

	"github.com/goapps-platform/runtime-service/internal/databinding"
	"github.com/goapps-platform/runtime-service/internal/gallery"
	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/google/uuid"
)

type gallerySessionAdapter struct {
	kernel *RuntimeKernel
}

func (a *gallerySessionAdapter) GalleryControl(sessionID uuid.UUID, controlID string) (gallery.ControlMetadata, uuid.UUID, uuid.UUID, uuid.UUID, error) {
	session, control, err := a.kernel.galleryControl(sessionID, controlID)
	if err != nil {
		return gallery.ControlMetadata{}, uuid.Nil, uuid.Nil, uuid.Nil, err
	}
	return toGalleryControl(session, control), session.TenantID, session.UserID, session.AppID, nil
}

func (a *gallerySessionAdapter) GalleryControls(sessionID uuid.UUID) ([]gallery.ControlMetadata, uuid.UUID, uuid.UUID, uuid.UUID, error) {
	session, ok := a.kernel.sessions.Get(sessionID)
	if !ok || session.Package == nil {
		return nil, uuid.Nil, uuid.Nil, uuid.Nil, ErrSessionNotFound
	}
	controls := galleryControlsForPackage(session.Package)
	return controls, session.TenantID, session.UserID, session.AppID, nil
}

func (k *RuntimeKernel) GallerySessionAdapter() gallery.SessionLookup {
	return &gallerySessionAdapter{kernel: k}
}

func (k *RuntimeKernel) SelectGalleryItem(ctx context.Context, sessionID uuid.UUID, controlID string, index int) (map[string]interface{}, []reactive.RefreshInstruction, error) {
	if k == nil || k.registry == nil || k.registry.Gallery == nil {
		return nil, nil, ErrGalleryNotFound
	}
	session, control, err := k.galleryControl(sessionID, controlID)
	if err != nil {
		return nil, nil, err
	}
	session.Touch()
	k.sessions.Put(session)

	selected, err := k.registry.Gallery.Select(sessionID, control.Name, index)
	if err != nil {
		return nil, nil, err
	}
	refresh := []reactive.RefreshInstruction{}
	if k.registry.Reactive != nil {
		resp := k.registry.Reactive.Notifier.GallerySelectionChanged(session.ID, session.AppID, control.Name)
		refresh = resp.Refresh
	}
	formRefresh := k.syncFormsFromGallery(session, control.Name)
	refresh = reactive.MergeRefresh(reactive.RefreshResponse{Refresh: refresh}, reactive.RefreshResponse{Refresh: formRefresh})
	_ = ctx
	return selected, refresh, nil
}

func (k *RuntimeKernel) galleryControl(sessionID uuid.UUID, controlID string) (*RuntimeSession, RuntimeControl, error) {
	session, ok := k.sessions.Get(sessionID)
	if !ok || session.Package == nil {
		return nil, RuntimeControl{}, ErrSessionNotFound
	}
	control, ok := session.Package.Controls[strings.ToLower(strings.TrimSpace(controlID))]
	if !ok {
		return nil, RuntimeControl{}, ErrControlNotFound
	}
	if !gallery.IsItemsControl(control.ControlType) {
		return nil, RuntimeControl{}, ErrControlNotFound
	}
	return session, control, nil
}

func (k *RuntimeKernel) loadScreenGalleries(ctx context.Context, session *RuntimeSession, screenName string) error {
	if k == nil || k.registry == nil || k.registry.Gallery == nil || session == nil || session.Package == nil {
		return nil
	}
	ctx = databinding.WithEnvironmentID(ctx, session.EnvironmentID)
	screenName = strings.TrimSpace(screenName)
	for _, control := range uniqueControls(session.Package) {
		if !gallery.IsItemsControl(control.ControlType) {
			continue
		}
		if screenName != "" && !strings.EqualFold(control.Screen, screenName) {
			continue
		}
		if _, err := k.registry.Gallery.Load(ctx, session.ID, session.TenantID, session.UserID, session.AppID, toGalleryControl(session, control)); err != nil {
			if errors.Is(err, databinding.ErrConnectorUserOAuthRequired) ||
				strings.Contains(err.Error(), databinding.ErrConnectorUserOAuthRequired.Error()) {
				log.Printf("kernel: gallery %s waiting for per-user oauth: %v", control.Name, err)
				continue
			}
			return err
		}
	}
	return nil
}

func (k *RuntimeKernel) syncGalleriesAfterRefresh(ctx context.Context, session *RuntimeSession, refresh []reactive.RefreshInstruction) error {
	if k == nil || k.registry == nil || k.registry.Gallery == nil || session == nil || session.Package == nil {
		return nil
	}
	controls := galleryControlsForPackage(session.Package)
	controlsByName := map[string]gallery.ControlMetadata{}
	for _, control := range controls {
		controlsByName[control.Name] = control
	}
	for _, item := range refresh {
		if item.Reason != string(reactive.EventDatasourceChanged) && item.Reason != string(reactive.EventCollectionChanged) {
			continue
		}
		control, ok := controlsByName[item.ControlID]
		if !ok {
			continue
		}
		source := gallery.ReadItemsFormula(control.Formulas, control.Properties)
		if source == "" {
			continue
		}
		if _, err := k.registry.Gallery.ReloadForSource(ctx, session.ID, session.TenantID, session.UserID, session.AppID, source, controls, session.State); err != nil {
			return err
		}
	}
	return nil
}

func toGalleryControl(session *RuntimeSession, control RuntimeControl) gallery.ControlMetadata {
	formulas := make([]gallery.FormulaBinding, 0, len(control.Formulas))
	for _, item := range control.Formulas {
		formulas = append(formulas, gallery.FormulaBinding{
			PropertyName: item.PropertyName,
			FormulaText:  item.FormulaText,
		})
	}
	entities := []string{}
	if session != nil && session.Package != nil {
		entities = append(entities, session.Package.Entities...)
		entities = append(entities, session.Package.Connectors...)
	}
	return gallery.ControlMetadata{
		Name:        control.Name,
		ControlType: control.ControlType,
		Screen:      control.Screen,
		Formulas:    formulas,
		Properties:  control.Properties,
		EntityNames: entities,
	}
}

func galleryControlsForPackage(pkg *Package) []gallery.ControlMetadata {
	controls := make([]gallery.ControlMetadata, 0)
	for _, control := range uniqueControls(pkg) {
		if !gallery.IsItemsControl(control.ControlType) {
			continue
		}
		controls = append(controls, toGalleryControl(&RuntimeSession{Package: pkg}, control))
	}
	return controls
}

func uniqueControls(pkg *Package) []RuntimeControl {
	if pkg == nil {
		return nil
	}
	byID := map[uuid.UUID]RuntimeControl{}
	for _, control := range pkg.Controls {
		if control.ID == uuid.Nil {
			continue
		}
		byID[control.ID] = control
	}
	controls := make([]RuntimeControl, 0, len(byID))
	for _, control := range byID {
		controls = append(controls, control)
	}
	return controls
}

var ErrGalleryNotFound = gallery.ErrGalleryNotFound
