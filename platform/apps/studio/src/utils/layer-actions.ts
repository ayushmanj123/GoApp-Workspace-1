import type { Control } from "../api/controls-api";

export type LayerAction =
  | "bringForward"
  | "sendBackward"
  | "bringToFront"
  | "sendToBack";

function getSiblings(controls: Control[], controlId: string): Control[] {
  const control = controls.find((item) => item.id === controlId);
  if (!control) {
    return [];
  }
  const parentId = control.parent_control_id;
  return controls
    .filter((item) => item.parent_control_id === parentId)
    .slice()
    .sort((a, b) => a.z_index - b.z_index || a.name.localeCompare(b.name));
}

function renumberZ(order: Control[]): Map<string, number> {
  const updates = new Map<string, number>();
  if (order.length === 0) {
    return updates;
  }
  const baseZ = Math.min(...order.map((item) => item.z_index));
  order.forEach((item, index) => {
    updates.set(item.id, baseZ + index);
  });
  return updates;
}

/** Returns control id → new z_index updates for a layer action among siblings. */
export function computeLayerUpdates(
  controls: Control[],
  controlId: string,
  action: LayerAction,
): Map<string, number> {
  const siblings = getSiblings(controls, controlId);
  const index = siblings.findIndex((item) => item.id === controlId);
  if (index === -1 || siblings.length <= 1) {
    return new Map();
  }

  if (action === "bringForward" && index < siblings.length - 1) {
    const reordered = siblings.slice();
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    return renumberZ(reordered);
  }

  if (action === "sendBackward" && index > 0) {
    const reordered = siblings.slice();
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    return renumberZ(reordered);
  }

  if (action === "bringToFront") {
    if (index === siblings.length - 1) {
      return new Map();
    }
    const reordered = siblings.slice();
    const [item] = reordered.splice(index, 1);
    reordered.push(item);
    return renumberZ(reordered);
  }

  if (action === "sendToBack") {
    if (index === 0) {
      return new Map();
    }
    const reordered = siblings.slice();
    const [item] = reordered.splice(index, 1);
    reordered.unshift(item);
    return renumberZ(reordered);
  }

  return new Map();
}
