import type { Control } from "../../api/controls-api";
import { buildControlTree, type ControlTreeNode } from "../../utils/build-control-tree";
import { supportsStudioRegistryRendering } from "../../utils/registry-type";
import {
  type DesignerBounds,
  type DesignerNode,
  isContainerType,
} from "./DesignerNode";
import { isControlLocked } from "../../utils/control-lock";

function toBounds(control: Control): DesignerBounds {
  return {
    x: control.x,
    y: control.y,
    width: Math.max(control.width, 1),
    height: Math.max(control.height, 1),
  };
}

function buildNode(
  treeNode: ControlTreeNode,
  parentAbsolute: DesignerBounds | null,
): DesignerNode {
  const local = toBounds(treeNode);
  const absoluteBounds: DesignerBounds = parentAbsolute
    ? {
        x: parentAbsolute.x + local.x,
        y: parentAbsolute.y + local.y,
        width: local.width,
        height: local.height,
      }
    : local;

  const container = isContainerType(treeNode.control_type);
  const registrySupported = supportsStudioRegistryRendering(treeNode.control_type);
  const locked = isControlLocked(treeNode);

  const children = treeNode.children.map((child) => buildNode(child, absoluteBounds));

  return {
    id: treeNode.id,
    controlId: treeNode.id,
    parentId: treeNode.parent_control_id,
    type: treeNode.control_type,
    name: treeNode.name,
    bounds: local,
    zIndex: treeNode.z_index,
    children,
    isContainer: container,
    selectable: registrySupported || !treeNode.parent_control_id,
    // Nested children are hittable in container-edit; allow drag so they can reparent
    draggable: !locked && (registrySupported || !treeNode.parent_control_id || container),
    resizable: !locked && (!treeNode.parent_control_id || container),
    absoluteBounds,
    control: treeNode,
  };
}

export function buildDesignerNodeRegistry(controls: Control[]): DesignerNode[] {
  const tree = buildControlTree(controls);
  return tree.map((node) => buildNode(node, null));
}

/** Flat list sorted by z-index descending for hit testing (top first). */
export function flattenDesignerNodes(nodes: DesignerNode[]): DesignerNode[] {
  const flat: DesignerNode[] = [];

  const walk = (node: DesignerNode) => {
    flat.push(node);
    for (const child of node.children) {
      walk(child);
    }
  };

  for (const node of nodes) {
    walk(node);
  }

  return flat.sort((a, b) => b.zIndex - a.zIndex);
}

export function findDesignerNode(
  nodes: DesignerNode[],
  controlId: string,
): DesignerNode | undefined {
  for (const node of flattenDesignerNodes(nodes)) {
    if (node.controlId === controlId) {
      return node;
    }
  }
  return undefined;
}
