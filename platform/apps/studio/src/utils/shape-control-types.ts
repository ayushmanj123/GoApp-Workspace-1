const SHAPE_TYPES = new Set([
  "shape_rectangle",
  "shape_ellipse",
  "shape_line",
  "shape_arrow",
  "shape_image",
  "shape_star",
]);

export function normalizeShapeKey(controlType: string): string {
  return controlType.trim().toLowerCase();
}

export function isShapeControlType(controlType: string): boolean {
  return SHAPE_TYPES.has(normalizeShapeKey(controlType));
}

export const SHAPE_CONTROL_TYPES = [...SHAPE_TYPES] as const;

export type ShapeControlType = (typeof SHAPE_CONTROL_TYPES)[number];
