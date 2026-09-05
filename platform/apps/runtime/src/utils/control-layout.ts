import type { CSSProperties } from "react";
import type { ControlPackage } from "../runtime-types";

export type DisplayMode = "Edit" | "View" | "Disabled";

export interface ResolvedLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  visible: boolean;
  displayMode: DisplayMode;
  disabled: boolean;
}

function readNumber(
  properties: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const raw = properties[key] ?? properties[key.toLowerCase()];
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function coerceVisibleValue(raw: unknown): boolean | null {
  if (typeof raw === "boolean") {
    return raw;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) return null;
    return trimmed !== "false" && trimmed !== "0";
  }
  if (typeof raw === "number") {
    return raw !== 0;
  }
  return null;
}

/** Exported for unit checks; resolves Studio `{ value }` wrappers and plain booleans. */
export function readVisible(properties: Record<string, unknown>): boolean {
  const raw = properties.Visible ?? properties.visible;
  const direct = coerceVisibleValue(raw);
  if (direct !== null) {
    return direct;
  }
  if (raw && typeof raw === "object" && "value" in raw) {
    const wrapped = coerceVisibleValue((raw as { value?: unknown }).value);
    if (wrapped !== null) {
      return wrapped;
    }
  }
  return true;
}

export function resolveDisplayMode(raw: unknown): DisplayMode | null {
  if (raw == null) return null;
  let value = "";
  if (typeof raw === "string") {
    value = raw.trim();
  } else if (typeof raw === "object" && "value" in raw) {
    value = String((raw as { value?: unknown }).value ?? "").trim();
  } else if (typeof raw === "object" && "formula" in raw) {
    value = String((raw as { formula?: unknown }).formula ?? "").trim();
  }
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === "disabled") return "Disabled";
  if (lower === "view") return "View";
  if (lower === "edit") return "Edit";
  return null;
}

function readDisplayMode(properties: Record<string, unknown>): DisplayMode {
  return (
    resolveDisplayMode(properties.DisplayMode ?? properties.displayMode) ?? "Edit"
  );
}

export function resolveControlLayout(control: ControlPackage): ResolvedLayout {
  const properties = {
    ...((control.properties as Record<string, unknown> | undefined) ?? {}),
  };
  const displayMode = readDisplayMode(properties);
  return {
    x: readNumber(properties, "X", control.x ?? 0),
    y: readNumber(properties, "Y", control.y ?? 0),
    width: readNumber(properties, "Width", control.width ?? 0),
    height: readNumber(properties, "Height", control.height ?? 0),
    zIndex: control.z_index ?? 0,
    visible: readVisible(properties),
    displayMode,
    disabled: displayMode === "Disabled",
  };
}

export function absoluteLayoutStyle(layout: ResolvedLayout): CSSProperties {
  return {
    position: "absolute",
    left: layout.x,
    top: layout.y,
    width: layout.width > 0 ? layout.width : undefined,
    height: layout.height > 0 ? layout.height : undefined,
    zIndex: layout.zIndex,
    boxSizing: "border-box",
  };
}

export function fillParentStyle(): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
  };
}

export function relativeContainerStyle(): CSSProperties {
  return {
    position: "relative",
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
  };
}

/** Normalize Studio direction aliases to CSS flex-direction. */
export function normalizeFlexDirection(
  direction: unknown,
): "row" | "column" {
  let raw = "";
  if (typeof direction === "string") {
    raw = direction.trim().toLowerCase();
  } else if (direction && typeof direction === "object" && "value" in direction) {
    raw = String((direction as { value?: unknown }).value ?? "")
      .trim()
      .toLowerCase();
  }
  if (raw === "horizontal" || raw === "row") return "row";
  return "column";
}
