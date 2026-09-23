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

function normalizeControlType(controlType: string): string {
  return controlType.trim().toLowerCase().replace(/_/g, "");
}

function powerFxName(key: string): string {
  if (!key) return key;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function symbolValue(raw: unknown, fallback = ""): string {
  return readStaticPropertyValue(raw, fallback);
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
): Record<string, Record<string, string>> {
  const symbols: Record<string, Record<string, string>> = {};

  for (const control of controls) {
    const name = control.name?.trim();
    if (!name) {
      continue;
    }

    const type = normalizeControlType(control.control_type);
    const properties = control.properties ?? {};
    const record: Record<string, string> = {};

    for (const label of ALWAYS_PRESENT) {
      record[label] = "";
    }

    for (const [key, value] of Object.entries(properties)) {
      record[powerFxName(key)] = symbolValue(value);
    }

    if (type === "textinput" && record.Value === undefined) {
      record.Value = symbolValue(properties.value);
    }
    if ((type === "button" || type === "label") && !record.Text) {
      record.Text = symbolValue(properties.text);
    }

    record.X = symbolValue(properties.x, control.x != null ? String(control.x) : "");
    record.Y = symbolValue(properties.y, control.y != null ? String(control.y) : "");
    record.Width = symbolValue(
      properties.width,
      control.width != null ? String(control.width) : "",
    );
    record.Height = symbolValue(
      properties.height,
      control.height != null ? String(control.height) : "",
    );
    if (properties.visible == null && properties.Visible == null) {
      record.Visible = "true";
    }

    symbols[name] = record;
  }

  return symbols;
}
