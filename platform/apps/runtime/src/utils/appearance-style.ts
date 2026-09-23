import type { CSSProperties } from "react";

/** Read a Studio `{ value }` wrapper or a plain scalar. Empty when unset. */
export function readPropertyText(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw === "boolean") return raw ? "true" : "false";
  if (typeof raw === "object") {
    const obj = raw as { value?: unknown };
    if ("value" in obj && obj.value != null && obj.value !== "") {
      return readPropertyText(obj.value);
    }
  }
  return "";
}

export function readOptionalNumber(raw: unknown): number | undefined {
  const text = readPropertyText(raw);
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function readBooleanProperty(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === "boolean") return raw;
  const text = readPropertyText(raw).toLowerCase();
  if (!text) return fallback;
  if (text === "true" || text === "1") return true;
  if (text === "false" || text === "0") return false;
  return fallback;
}

function fontWeightCss(raw: string): CSSProperties["fontWeight"] | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower === "bold") return 700;
  if (lower === "normal" || lower === "regular") return 400;
  if (lower === "light") return 300;
  if (lower === "semibold" || lower === "semi-bold") return 600;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 100 && n <= 900) return n;
  return raw as CSSProperties["fontWeight"];
}

function opacityCss(raw: unknown): number | undefined {
  const n = readOptionalNumber(raw);
  if (n == null) return undefined;
  if (n > 1 && n <= 100) return n / 100;
  return Math.min(1, Math.max(0, n));
}

export interface ChromeColors {
  fill: string;
  color: string;
  borderColor: string;
  hoverFill: string;
  pressedFill: string;
  disabledFill: string;
  hoverColor: string;
  pressedColor: string;
  focusedBorderColor: string;
}

/** CSS for authored appearance. Omitted keys keep the control's built-in chrome. */
export function appearanceCss(
  colors: Partial<ChromeColors>,
  source: Record<string, unknown>,
  options?: { includeText?: boolean },
): CSSProperties {
  const style: CSSProperties = {};
  if (colors.fill) {
    style.background = colors.fill;
    style.backgroundColor = colors.fill;
  }
  if (options?.includeText !== false && colors.color) {
    style.color = colors.color;
  }
  const thickness = readOptionalNumber(source.borderThickness ?? source.BorderThickness);
  const borderColor = colors.borderColor;
  if (borderColor || thickness != null) {
    style.borderStyle = "solid";
    style.borderWidth = thickness ?? 1;
    if (borderColor) style.borderColor = borderColor;
  }
  const radius = readOptionalNumber(source.radius ?? source.Radius);
  if (radius != null) style.borderRadius = radius;
  const padding = readOptionalNumber(source.padding ?? source.Padding);
  if (padding != null) style.padding = padding;
  const opacity = opacityCss(source.opacity ?? source.Opacity);
  if (opacity != null) style.opacity = opacity;

  if (options?.includeText === false) return style;

  const font = readPropertyText(source.font ?? source.Font);
  if (font) style.fontFamily = font;
  const size = readOptionalNumber(source.size ?? source.Size);
  if (size != null && size > 0) style.fontSize = size;
  const weight = fontWeightCss(
    readPropertyText(source.fontWeight ?? source.weight ?? source.FontWeight ?? source.Weight),
  );
  if (weight != null) style.fontWeight = weight;
  const align = readPropertyText(source.align ?? source.Align).toLowerCase();
  if (align === "left" || align === "center" || align === "right" || align === "justify") {
    style.textAlign = align;
  }
  return style;
}

export function resolveInteractionStyle(
  base: CSSProperties,
  colors: Partial<ChromeColors>,
  state: { hover: boolean; pressed: boolean; focused: boolean; disabled: boolean },
): CSSProperties {
  const style: CSSProperties = { ...base };
  if (state.disabled && colors.disabledFill) {
    style.background = colors.disabledFill;
    style.backgroundColor = colors.disabledFill;
  } else if (state.pressed && colors.pressedFill) {
    style.background = colors.pressedFill;
    style.backgroundColor = colors.pressedFill;
  } else if (state.hover && colors.hoverFill) {
    style.background = colors.hoverFill;
    style.backgroundColor = colors.hoverFill;
  }
  if (!state.disabled && state.pressed && colors.pressedColor) {
    style.color = colors.pressedColor;
  } else if (!state.disabled && state.hover && colors.hoverColor) {
    style.color = colors.hoverColor;
  }
  if (state.focused && colors.focusedBorderColor) {
    style.borderColor = colors.focusedBorderColor;
    if (style.borderWidth == null) style.borderWidth = 1;
    if (style.borderStyle == null) style.borderStyle = "solid";
  }
  return style;
}
