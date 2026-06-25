import { ARTBOARD_H, ARTBOARD_W, CANVAS_PADDING } from "./constants";

export interface ArtboardOffset {
  stageX: number;
  stageY: number;
}

export function computeArtboardOffset(
  viewportWidth: number,
  viewportHeight: number,
  zoom = 100,
): ArtboardOffset {
  const scaledW = ARTBOARD_W * (zoom / 100);
  const scaledH = ARTBOARD_H * (zoom / 100);
  const offsetX = (viewportWidth - scaledW) / 2;
  const offsetY = (viewportHeight - scaledH) / 2;
  return {
    stageX: Math.max(offsetX, CANVAS_PADDING),
    stageY: Math.max(offsetY, CANVAS_PADDING),
  };
}

export function toScreenBounds(
  control: { x: number; y: number; width: number; height: number },
  offset: ArtboardOffset,
  zoom = 100,
): { left: number; top: number; width: number; height: number } {
  const scale = zoom / 100;
  return {
    left: offset.stageX + control.x * scale,
    top: offset.stageY + control.y * scale,
    width: Math.max(control.width * scale, 1),
    height: Math.max(control.height * scale, 1),
  };
}
