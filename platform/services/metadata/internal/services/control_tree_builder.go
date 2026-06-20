package services

import (
	"fmt"
	"sort"

	"github.com/goapps-platform/metadata-service/internal/api/contracts"
)

// buildControlTree builds hierarchical tree from flat controls
func buildControlTree(flat []contracts.RuntimeControl) ([]contracts.RuntimeControl, error) {
	nodes := make([]contracts.RuntimeControl, len(flat))
	copy(nodes, flat)

	byID := map[string]*contracts.RuntimeControl{}
	rootIDs := make([]string, 0, len(nodes))

	for i := range nodes {
		id := nodes[i].ID.String()
		if _, exists := byID[id]; exists {
			return nil, fmt.Errorf("duplicate control id %s", id)
		}
		byID[id] = &nodes[i]
	}

	for i := range nodes {
		node := &nodes[i]
		if node.ParentControlID == nil {
			rootIDs = append(rootIDs, node.ID.String())
			continue
		}
		parentID := node.ParentControlID.String()
		if parentID == node.ID.String() {
			return nil, fmt.Errorf("control %s cannot be its own parent", node.ID.String())
		}
		parent := byID[parentID]
		if parent == nil {
			rootIDs = append(rootIDs, node.ID.String())
			continue
		}
		parent.Children = append(parent.Children, *node)
	}

	roots := make([]contracts.RuntimeControl, 0, len(rootIDs))
	for _, id := range rootIDs {
		roots = append(roots, *byID[id])
	}
	sortControlsByZIndex(roots)
	return roots, nil
}

func sortControlsByZIndex(controls []contracts.RuntimeControl) {
	sort.Slice(controls, func(i, j int) bool { return controls[i].ZIndex < controls[j].ZIndex })
	for i := range controls {
		sortControlsByZIndex(controls[i].Children)
	}
}
