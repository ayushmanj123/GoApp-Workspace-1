package services

import "github.com/goapps-platform/metadata-service/internal/api"

// buildControlTree builds hierarchical tree from flat controls
func buildControlTree(flat []api.RuntimeControl) []api.RuntimeControl {
	byID := map[string]*api.RuntimeControl{}
	var roots []api.RuntimeControl
	for i := range flat {
		c := flat[i]
		byID[c.ID.String()] = &c
	}
	// attach children
	for i := range flat {
		c := flat[i]
		if c.ParentControlID == nil {
			roots = append(roots, c)
			continue
		}
		parent := byID[c.ParentControlID.String()]
		if parent == nil {
			roots = append(roots, c)
			continue
		}
		parent.Children = append(parent.Children, c)
	}
	return roots
}
