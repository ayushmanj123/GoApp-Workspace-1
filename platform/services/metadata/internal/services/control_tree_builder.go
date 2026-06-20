package services

import "github.com/goapps-platform/metadata-service/internal/api/contracts"

// buildControlTree builds hierarchical tree from flat controls
func buildControlTree(flat []contracts.RuntimeControl) []contracts.RuntimeControl {
	byID := map[string]*contracts.RuntimeControl{}
	var roots []contracts.RuntimeControl
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
