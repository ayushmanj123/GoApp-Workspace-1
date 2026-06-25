import type { CSSProperties } from "react";
import type { ControlPackage } from "../runtime-types";

export type DisplayMode = "Edit" | "View" | "Disabled";

export interface ResolvedLayout {
  x: number;
  y: number;
  width: number;
  height: number;
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

function readVisible(properties: Record<string, unknown>): boolean {
  const raw = properties.Visible ?? properties.visible;
  if (typeof raw === "boolean") {
    return raw;
  }
  if (typeof raw === "string") {
    return raw.toLowerCase() !== "false";
  }
  return true;
}

function readDisplayMode(properties: Record<string, unknown>): DisplayMode {
  const raw = properties.DisplayMode ?? properties.displayMode;
  if (raw && typeof raw === "object" && "value" in raw) {
    const value = String((raw as { value?: unknown }).value ?? "").trim();
    if (value.toLowerCase() === "disabled") return "Disabled";
    if (value.toLowerCase() === "view") return "View";
    return "Edit";
  }
  if (typeof raw === "string") {
    const value = raw.trim();
    if (value.toLowerCase() === "disabled") return "Disabled";
    if (value.toLowerCase() === "view") return "View";
    if (value.toLowerCase() === "edit") return "Edit";
  }
  return "Edit";
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
