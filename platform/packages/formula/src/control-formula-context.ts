import { readStaticPropertyValue } from "./resolve-property-value.js";

export interface FormulaControlContextInput {
  name?: string;
  control_type: string;
  properties?: Record<string, unknown> | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export type FormulaSymbolValue = string | number | boolean;

function normalizeControlType(controlType: string): string {
  return controlType.trim().toLowerCase().replace(/_/g, "");
}

function powerFxName(key: string): string {
  if (!key) return key;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

const NUMERIC_PROPERTIES = new Set([
  "X",
  "Y",
  "Width",
  "Height",
  "Min",
  "Max",
  "BorderThickness",
  "Radius",
  "Padding",
  "Opacity",
  "Size",
  "TabIndex",
  "LineHeight",
  "MaxLength",
  "Limit",
  "PageSize",
  "Offset",
  "TemplateSize",
  "TemplatePadding",
  "Columns",
  "Duration",
  "Gap",
  "Rotation",
  "StrokeWidth",
  "NumPoints",
  "InnerRadius",
]);

const BOOLEAN_PROPERTIES = new Set([
  "Visible",
  "Disabled",
  "ShowValue",
  "Wrap",
  "AutoHeight",
  "Italic",
  "Underline",
  "Required",
  "Clear",
  "DelayOutput",
  "ShowScrollbar",
  "Selectable",
  "AutoStart",
  "Start",
  "Repeat",
  "AutoPause",
  "Checked",
  "AllowEmptySelection",
  "IsSearchable",
  "AutoDisableOnSelect",
]);

const NUMERIC_VALUE_CONTROLS = new Set(["slider", "progress", "rating"]);

function symbolText(raw: unknown, fallback = ""): string {
  return readStaticPropertyValue(raw, fallback);
}

function unwrapSymbol(raw: unknown): unknown {
  if (raw && typeof raw === "object") {
    if ("formula" in raw) return undefined;
    if ("value" in raw) return (raw as { value?: unknown }).value;
  }
  return raw;
}

function isNumericSymbol(propertyName: string, controlType: string): boolean {
  if (NUMERIC_PROPERTIES.has(propertyName)) return true;
  return propertyName === "Value" && NUMERIC_VALUE_CONTROLS.has(controlType);
}

function isBooleanSymbol(propertyName: string): boolean {
  return BOOLEAN_PROPERTIES.has(propertyName);
}

function toSymbolNumber(raw: unknown, fallback: number): number {
  const value = unwrapSymbol(raw);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toSymbolBoolean(raw: unknown, fallback: boolean): boolean {
  const value = unwrapSymbol(raw);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (text === "true" || text === "1") return true;
    if (text === "false" || text === "0") return false;
  }
  return fallback;
}

function booleanFallback(propertyName: string): boolean {
  return propertyName === "Visible";
}

/** Keep numeric and boolean fields typed after a live value overwrites them. */
export function coerceControlSymbolFields(
  controlType: string,
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const type = normalizeControlType(controlType);
  const next: Record<string, unknown> = { ...fields };
  for (const [key, value] of Object.entries(next)) {
    if (isNumericSymbol(key, type)) {
      next[key] = toSymbolNumber(value, 0);
    } else if (isBooleanSymbol(key)) {
      next[key] = toSymbolBoolean(value, booleanFallback(key));
    }
  }
  return next;
}

const ALWAYS_PRESENT = [
  "Visible",
  "DisplayMode",
  "Disabled",
  "Text",
  "Tooltip",
  "X",
  "Y",
  "Width",
  "Height",
] as const;

export function buildControlFormulaSymbols(
  controls: FormulaControlContextInput[],
): Record<string, Record<string, FormulaSymbolValue>> {
  const symbols: Record<string, Record<string, FormulaSymbolValue>> = {};

  for (const control of controls) {
    const name = control.name?.trim();
    if (!name) {
      continue;
    }

    const type = normalizeControlType(control.control_type);
    const properties = control.properties ?? {};
    const record: Record<string, FormulaSymbolValue> = {};

    for (const label of ALWAYS_PRESENT) {
      if (label === "Visible") record[label] = true;
      else if (label === "Disabled") record[label] = false;
      else if (isNumericSymbol(label, type)) record[label] = 0;
      else record[label] = "";
    }

    for (const [key, value] of Object.entries(properties)) {
      if (key.startsWith("component_") || key === "definition_id" || key === "definition_name") {
        continue;
      }
      const label = powerFxName(key);
      if (isNumericSymbol(label, type)) {
        record[label] = toSymbolNumber(value, 0);
      } else if (isBooleanSymbol(label)) {
        record[label] = toSymbolBoolean(value, booleanFallback(label));
      } else {
        record[label] = symbolText(value);
      }
    }

    if (type === "textinput" && record.Value === undefined) {
      record.Value = symbolText(properties.value);
    }
    if ((type === "button" || type === "label") && !record.Text) {
      record.Text = symbolText(properties.text);
    }

    record.X = toSymbolNumber(properties.x, control.x ?? 0);
    record.Y = toSymbolNumber(properties.y, control.y ?? 0);
    record.Width = toSymbolNumber(properties.width, control.width ?? 0);
    record.Height = toSymbolNumber(properties.height, control.height ?? 0);
    if (properties.visible == null && properties.Visible == null) {
      record.Visible = true;
    }

    symbols[name] = record;
  }

  return symbols;
}

/** Power Fx tables are arrays of records. Scalar rows become `{ Value: row }`. */
export function asFormulaTable(items: unknown[]): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const item of items) {
    if (item == null) continue;
    if (typeof item === "object" && !Array.isArray(item)) {
      rows.push(item as Record<string, unknown>);
    } else {
      rows.push({ Value: item as string | number | boolean });
    }
  }
  return rows;
}
