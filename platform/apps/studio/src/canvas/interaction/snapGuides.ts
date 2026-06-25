import { SNAP_GRID } from "../constants";
import type { DesignerNode } from "../designer/DesignerNode";
import { flattenDesignerNodes } from "../designer/DesignerNodeRegistry";

const SNAP_THRESHOLD = 6;

export interface SnapResult {
  x: number;
  y: number;
  guides: { orientation: "h" | "v"; position: number }[];
}

/** Snap drag position to grid and sibling edges. */
export function snapPosition(
  nodes: DesignerNode[],
  controlId: string,
  x: number,
  y: number,
  width: number,
  height: number,
): SnapResult {
  const guides: { orientation: "h" | "v"; position: number }[] = [];
  let snappedX = Math.round(x / SNAP_GRID) * SNAP_GRID;
  let snappedY = Math.round(y / SNAP_GRID) * SNAP_GRID;

  const flat = flattenDesignerNodes(nodes);
  const others = flat.filter((n) => n.controlId !== controlId);

  const edges = {
    left: snappedX,
    right: snappedX + width,
    top: snappedY,
    bottom: snappedY + height,
    centerX: snappedX + width / 2,
    centerY: snappedY + height / 2,
  };

  for (const other of others) {
    const b = other.absoluteBounds;
    const oEdges = [
      { v: b.x, o: "v" as const },
      { v: b.x + b.width, o: "v" as const },
      { v: b.x + b.width / 2, o: "v" as const },
      { v: b.y, o: "h" as const },
      { v: b.y + b.height, o: "h" as const },
      { v: b.y + b.height / 2, o: "h" as const },
    ];

    for (const { v, o } of oEdges) {
      for (const [key, val] of Object.entries(edges)) {
        if (Math.abs(val - v) <= SNAP_THRESHOLD) {
          const delta = v - val;
          if (o === "v") {
            if (key.includes("left") || key === "centerX") snappedX += delta;
            else if (key.includes("right")) snappedX += delta;
            guides.push({ orientation: "v", position: v });
          } else {
            if (key.includes("top") || key === "centerY") snappedY += delta;
            else if (key.includes("bottom")) snappedY += delta;
            guides.push({ orientation: "h", position: v });
          }
        }
      }
    }
  }

  return { x: snappedX, y: snappedY, guides };
}
