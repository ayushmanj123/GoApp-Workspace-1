package services

import (
	"testing"

	"github.com/goapps-platform/metadata-service/internal/api/contracts"
	"github.com/google/uuid"
)

func TestBuildControlTreeRejectsDuplicateIDs(t *testing.T) {
	id := uuid.New()
	_, err := buildControlTree([]contracts.RuntimeControl{
		{ID: id, Name: "A", ZIndex: 1},
		{ID: id, Name: "B", ZIndex: 2},
	})
	if err == nil {
		t.Fatalf("expected duplicate id error")
	}
}

func TestBuildControlTreeSortsByZIndex(t *testing.T) {
	parentID := uuid.New()
	childAID := uuid.New()
	childBID := uuid.New()
	roots, err := buildControlTree([]contracts.RuntimeControl{
		{ID: parentID, Name: "Parent", ZIndex: 10},
		{ID: uuid.New(), Name: "RootLow", ZIndex: 1},
		{ID: childAID, ParentControlID: &parentID, Name: "ChildHigh", ZIndex: 9},
		{ID: childBID, ParentControlID: &parentID, Name: "ChildLow", ZIndex: 2},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(roots) != 2 {
		t.Fatalf("expected 2 roots")
	}
	if roots[0].Name != "RootLow" || roots[1].Name != "Parent" {
		t.Fatalf("expected roots sorted by z-index")
	}
	if len(roots[1].Children) != 2 {
		t.Fatalf("expected 2 child controls")
	}
	if roots[1].Children[0].Name != "ChildLow" || roots[1].Children[1].Name != "ChildHigh" {
		t.Fatalf("expected children sorted by z-index")
	}
}
