import { ARTBOARD_H, ARTBOARD_W, MIN_CONTROL_SIZE } from "../constants";

/** Clamp absolute artboard bounds so the control stays fully inside the artboard. */
export function clampRectToArtboard(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const w = Math.min(ARTBOARD_W, Math.max(MIN_CONTROL_SIZE, width));
  const h = Math.min(ARTBOARD_H, Math.max(MIN_CONTROL_SIZE, height));
  const maxX = Math.max(0, ARTBOARD_W - w);
  const maxY = Math.max(0, ARTBOARD_H - h);
  return {
    x: Math.min(maxX, Math.max(0, x)),
    y: Math.min(maxY, Math.max(0, y)),
    width: w,
    height: h,
  };
}

/** Clamp a top-left position after snap so the full rect stays on the artboard. */
export function clampPositionToArtboard(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const clamped = clampRectToArtboard(x, y, width, height);
  return { x: clamped.x, y: clamped.y };
}
