import type { DesignerNode } from "../designer/DesignerNode";
import { flattenDesignerNodes } from "../designer/DesignerNodeRegistry";

function containsPoint(node: DesignerNode, x: number, y: number): boolean {
  const b = node.absoluteBounds;
  return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
}

function isDescendantOfId(
  node: DesignerNode,
  ancestorId: string,
  byId: Map<string, DesignerNode>,
): boolean {
  let current: string | null = node.parentId;
  while (current) {
    if (current === ancestorId) {
      return true;
    }
    current = byId.get(current)?.parentId ?? null;
  }
  return false;
}

export function hitTestAtPoint(
  nodes: DesignerNode[],
  x: number,
  y: number,
  opts?: { containerEditId?: string | null },
): DesignerNode | null {
  const flat = flattenDesignerNodes(nodes);
  const byId = new Map(flat.map((n) => [n.controlId, n]));
  const containerEditId = opts?.containerEditId ?? null;

  const candidates = flat.filter(
    (node) => node.selectable && containsPoint(node, x, y),
  );

  if (candidates.length === 0) {
    return null;
  }

  if (containerEditId) {
    const inContainer = candidates.filter(
      (node) =>
        node.controlId === containerEditId ||
        isDescendantOfId(node, containerEditId, byId),
    );
    return inContainer.sort((a, b) => b.zIndex - a.zIndex)[0] ?? null;
  }

  const roots = candidates.filter((node) => !node.parentId);
  return roots.sort((a, b) => b.zIndex - a.zIndex)[0] ?? null;
}

function nodeDepth(node: DesignerNode, byId: Map<string, DesignerNode>): number {
  let depth = 0;
  let current: string | null = node.parentId;
  while (current) {
    depth += 1;
    current = byId.get(current)?.parentId ?? null;
  }
  return depth;
}

/** Topmost container at a point (deepest nested, then highest z-index). */
export function hitTestContainerAtPoint(
  nodes: DesignerNode[],
  x: number,
  y: number,
  opts?: {
    containerEditId?: string | null;
    /** Skip this control and its descendants (reparent / nest-into-self guard). */
    excludeControlId?: string | null;
  },
): DesignerNode | null {
  const flat = flattenDesignerNodes(nodes);
  const byId = new Map(flat.map((n) => [n.controlId, n]));
  const containerEditId = opts?.containerEditId ?? null;
  const excludeControlId = opts?.excludeControlId ?? null;

  let candidates = flat.filter(
    (node) => node.isContainer && containsPoint(node, x, y),
  );

  if (excludeControlId) {
    candidates = candidates.filter(
      (node) =>
        node.controlId !== excludeControlId &&
        !isDescendantOfId(node, excludeControlId, byId),
    );
  }

  if (containerEditId) {
    candidates = candidates.filter(
      (node) =>
        node.controlId === containerEditId ||
        isDescendantOfId(node, containerEditId, byId),
    );
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort((a, b) => {
    const depthDiff = nodeDepth(b, byId) - nodeDepth(a, byId);
    if (depthDiff !== 0) {
      return depthDiff;
    }
    return b.zIndex - a.zIndex;
  })[0];
}

export function hitTestInRect(
  nodes: DesignerNode[],
  rect: { x: number; y: number; width: number; height: number },
): DesignerNode[] {
  const flat = flattenDesignerNodes(nodes);
  return flat.filter((node) => {
    if (!node.selectable || node.parentId) {
      return false;
    }
    const b = node.absoluteBounds;
    return !(
      b.x + b.width < rect.x ||
      b.x > rect.x + rect.width ||
      b.y + b.height < rect.y ||
      b.y > rect.y + rect.height
    );
  });
}
