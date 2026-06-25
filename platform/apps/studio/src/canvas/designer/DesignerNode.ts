import type { Control } from "../../api/controls-api";

export interface DesignerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesignerNode {
  id: string;
  controlId: string;
  parentId: string | null;
  type: string;
  name: string;
  bounds: DesignerBounds;
  zIndex: number;
  children: DesignerNode[];
  isContainer: boolean;
  selectable: boolean;
  draggable: boolean;
  resizable: boolean;
  /** Artboard-absolute bounds for hit testing */
  absoluteBounds: DesignerBounds;
  control: Control;
}

const CONTAINER_TYPES = new Set(["gallery", "form", "component"]);

export function isContainerType(controlType: string): boolean {
  return CONTAINER_TYPES.has(controlType.trim().toLowerCase().replace(/_/g, ""));
}
