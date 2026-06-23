import {
  getPropertyDefinitions,
  type PropertyFieldType,
  type PropertyMode,
} from "../property-metadata/registry";

export type PropertyEntry =
  | { value: string | boolean | number }
  | { formula: string };

function readCanonicalValue(value: unknown): unknown {
  if (value && typeof value === "object") {
    if ("formula" in value) {
      return undefined;
    }
    if ("value" in value) {
      return (value as { value: unknown }).value;
    }
  }
  return value;
}

export function getPropertyMode(value: unknown): PropertyMode {
  if (value && typeof value === "object" && "formula" in value) {
    return "formula";
  }
  return "static";
}

export function isFormulaProperty(value: unknown): boolean {
  return getPropertyMode(value) === "formula";
}

export function readPropertyFormula(value: unknown): string {
  if (value && typeof value === "object" && "formula" in value) {
    const formula = (value as { formula?: unknown }).formula;
    return typeof formula === "string" ? formula : String(formula ?? "");
  }
  return "";
}

export function writePropertyFormula(formula: string): { formula: string } {
  return { formula };
}

/** Read a property value for display in the property panel. */
export function readPropertyValue(
  type: PropertyFieldType,
  value: unknown,
): string | boolean | number {
  const raw = readCanonicalValue(value);

  switch (type) {
    case "boolean":
      return Boolean(raw);
    case "number": {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    case "text":
    case "color":
      if (typeof raw === "string") return raw;
      if (typeof raw === "number") return String(raw);
      return "";
    default:
      return "";
  }
}

/** Write a property value in canonical runtime metadata format. */
export function writePropertyValue(
  type: PropertyFieldType,
  value: string | boolean | number,
): { value: string | boolean | number } {
  switch (type) {
    case "boolean":
      return { value: Boolean(value) };
    case "number": {
      const parsed = Number(value);
      return { value: Number.isFinite(parsed) ? parsed : 0 };
    }
    case "text":
    case "color":
      return { value: String(value) };
    default:
      return { value: String(value) };
  }
}

function serializePropertyEntry(
  type: PropertyFieldType,
  value: unknown,
): PropertyEntry {
  if (isFormulaProperty(value)) {
    return { formula: readPropertyFormula(value) };
  }
  return writePropertyValue(type, readPropertyValue(type, value));
}

/** @deprecated Use readPropertyValue with type "text". */
export function readTextValue(value: unknown): string {
  return String(readPropertyValue("text", value));
}

export function truncateFormula(formula: string, maxLength = 48): string {
  const trimmed = formula.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength)}...`;
}

/** Build API payload for control properties (canonical runtime format). */
export function buildPropertiesPayload(
  properties: Record<string, unknown> | null,
  controlType?: string,
): Record<string, unknown> | null {
  if (!properties) {
    return null;
  }

  const definitions = controlType ? getPropertyDefinitions(controlType) : [];
  const payload: Record<string, unknown> = {};

  if (definitions.length > 0) {
    for (const def of definitions) {
      if (!(def.name in properties)) {
        continue;
      }
      payload[def.name] = serializePropertyEntry(
        def.type,
        properties[def.name],
      );
    }
  } else if ("text" in properties) {
    payload.text = serializePropertyEntry("text", properties.text);
  }

  return Object.keys(payload).length > 0 ? payload : null;
}
