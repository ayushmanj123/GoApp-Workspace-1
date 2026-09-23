import type { CSSProperties } from "react";
import { readDesignerDisplay } from "./designer-display";

function text(source: Record<string, unknown> | undefined, key: string): string {
  if (!source) return "";
  const value = readDesignerDisplay(source[key], "");
  if (!value || value.startsWith("[")) return "";
  return value;
}

function num(source: Record<string, unknown> | undefined, key: string): number | undefined {
  const raw = text(source, key);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Designer preview chrome. Only authored values override the control's built-in look. */
export function designerChromeStyle(
  source: Record<string, unknown> | undefined,
): CSSProperties {
  const style: CSSProperties = {};
  const fill = text(source, "fill");
  if (fill) style.background = fill;
  const color = text(source, "color");
  if (color) style.color = color;
  const borderColor = text(source, "borderColor");
  const thickness = num(source, "borderThickness");
  if (borderColor || thickness != null) {
    style.border = `${thickness ?? 1}px solid ${borderColor || "#c8c8c8"}`;
  }
  const radius = num(source, "radius");
  if (radius != null) style.borderRadius = radius;
  const padding = num(source, "padding");
  if (padding != null) style.padding = padding;
  const opacity = num(source, "opacity");
  if (opacity != null) style.opacity = opacity > 1 && opacity <= 100 ? opacity / 100 : opacity;
  const font = text(source, "font");
  if (font) style.fontFamily = font;
  const size = num(source, "size");
  if (size != null && size > 0) style.fontSize = size;
  const weight = text(source, "fontWeight") || text(source, "weight");
  if (weight) style.fontWeight = weight;
  const align = text(source, "align").toLowerCase();
  if (align === "left" || align === "center" || align === "right" || align === "justify") {
    style.textAlign = align;
  }
  return style;
}
