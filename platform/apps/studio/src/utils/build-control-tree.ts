import type { Control } from "../api/controls-api";

export interface ControlTreeNode extends Control {
  children: ControlTreeNode[];
}

/** Builds a hierarchical tree from flat controls (mirrors metadata buildControlTree). */
export function buildControlTree(flat: Control[]): ControlTreeNode[] {
  const nodes: ControlTreeNode[] = flat.map((control) => ({
    ...control,
    children: [],
  }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const roots: ControlTreeNode[] = [];

  for (const node of nodes) {
    if (!node.parent_control_id) {
      roots.push(node);
      continue;
    }
    const parent = byId.get(node.parent_control_id);
    if (!parent) {
      roots.push(node);
      continue;
    }
    parent.children.push(node);
  }

  const sortByZIndex = (items: ControlTreeNode[]) => {
    items.sort((a, b) => a.z_index - b.z_index);
    for (const item of items) {
      sortByZIndex(item.children);
    }
  };
  sortByZIndex(roots);
  return roots;
}
