import { readStaticPropertyValue } from "./resolve-property-value.js";

export interface FormulaControlContextInput {
  name?: string;
  control_type: string;
  properties?: Record<string, unknown> | null;
}

function normalizeControlType(controlType: string): string {
  return controlType.trim().toLowerCase().replace(/_/g, "");
}

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

    if (type === "button" || type === "label") {
      symbols[name] = {
        Text: readStaticPropertyValue(properties.text, ""),
      };
      continue;
    }

    if (type === "textinput") {
      symbols[name] = {
        Value: readStaticPropertyValue(properties.value, ""),
      };
    }
  }

  return symbols;
}
