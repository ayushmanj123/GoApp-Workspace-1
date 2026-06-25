package kernel

import (
	"strings"

	"github.com/goapps-platform/runtime-service/internal/reactive"
	"github.com/goapps-platform/runtime-service/internal/renderer"
	"github.com/google/uuid"
)

type renderSessionAdapter struct {
	kernel *RuntimeKernel
}

func (k *RuntimeKernel) RenderSessionAdapter() renderer.SessionLookup {
	return &renderSessionAdapter{kernel: k}
}

func (a *renderSessionAdapter) RenderSession(sessionID uuid.UUID) (uuid.UUID, renderer.SessionAccess, error) {
	session, ok := a.kernel.sessions.Get(sessionID)
	if !ok || session.Package == nil {
		return uuid.Nil, nil, renderer.ErrSessionNotFound
	}
	return sessionID, &renderSessionAccess{
		propertySessionAccess: &propertySessionAccess{kernel: a.kernel, session: session},
	}, nil
}

type renderSessionAccess struct {
	*propertySessionAccess
}

func (a *renderSessionAccess) ScreenName(screenID string) string {
	if a == nil || a.session == nil || a.session.Package == nil {
		return strings.TrimSpace(screenID)
	}
	screenID = strings.TrimSpace(screenID)
	if screen, ok := a.session.Package.ScreensByName[strings.ToLower(screenID)]; ok {
		return screen.Name
	}
	for _, screen := range a.session.Package.Screens {
		if strings.EqualFold(screen.ID.String(), screenID) {
			return screen.Name
		}
		if strings.EqualFold(screen.Name, screenID) {
			return screen.Name
		}
	}
	return screenID
}

func (k *RuntimeKernel) registerRendererDependencies(session *RuntimeSession) {
	if k == nil || k.registry == nil || k.registry.Renderer == nil || session == nil || session.Package == nil {
		return
	}
	k.registry.Renderer.RegisterDependencies(session.ID, propertyControlsForPackage(session.Package))
}

func (k *RuntimeKernel) invalidateRendererCache(sessionID uuid.UUID, refresh []reactive.RefreshInstruction) {
	if k == nil || k.registry == nil || k.registry.Renderer == nil {
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
		k.registry.Renderer.InvalidateControl(sessionID, item.ControlID)
	}
}

func (k *RuntimeKernel) invalidateRendererEvent(sessionID uuid.UUID, event reactive.Event) {
	if k == nil || k.registry == nil || k.registry.Renderer == nil {
		return
	}
	k.registry.Renderer.InvalidateEvent(sessionID, event)
}
