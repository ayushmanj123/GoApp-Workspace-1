import type { FormulaEngine } from "./formula-engine.js";

const FORMULA_ERROR = "[Formula Error]";

function readStaticValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function formatEvaluatedValue(result: unknown): string {
  if (result === null || result === undefined) {
    return "";
  }
  return String(result);
}

export async function resolvePropertyValue(
  property: unknown,
  engine: FormulaEngine,
  fallback = "",
  context?: Record<string, unknown>,
): Promise<string> {
  const scalar = readStaticValue(property);
  if (scalar !== null) {
    return scalar;
  }

  if (!property || typeof property !== "object") {
    return fallback;
  }

  if ("formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    const formulaText = typeof formula === "string" ? formula : String(formula ?? "");

    if (!formulaText.trim()) {
      return fallback;
    }

    try {
      const result = await engine.evaluate(formulaText, context);
      return formatEvaluatedValue(result);
    } catch (error) {
      console.error("[formula] evaluation failed:", error);
      return FORMULA_ERROR;
    }
  }

  if ("value" in property) {
    const staticValue = readStaticValue(
      (property as { value?: unknown }).value,
    );
    if (staticValue !== null) {
      return staticValue;
    }
  }

  return fallback;
}

export function readStaticPropertyValue(
  property: unknown,
  fallback = "",
): string {
  const scalar = readStaticValue(property);
  if (scalar !== null) {
    return scalar;
  }

  if (!property || typeof property !== "object") {
    return fallback;
  }

  if ("formula" in property) {
    return fallback;
  }

  if ("value" in property) {
    const staticValue = readStaticValue(
      (property as { value?: unknown }).value,
    );
    if (staticValue !== null) {
      return staticValue;
    }
  }

  return fallback;
}
