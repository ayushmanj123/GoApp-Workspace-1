import {
  createDefaultFormulaEngine,
  type FormulaEngine,
} from "@goapps/formula";

let displayEngine: FormulaEngine | undefined;
let displayEngineReady: Promise<boolean> | undefined;

function powerFxContext(
  context?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    const sanitized = sanitizePowerFxValue(value);
    if (sanitized !== undefined) next[key] = sanitized;
  }
  return next;
}

function sanitizePowerFxValue(value: unknown): unknown {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    const rows = value
      .map((item) => sanitizePowerFxValue(item))
      .filter((item) => item && typeof item === "object" && !Array.isArray(item));
    return rows;
  }
  if (value && typeof value === "object") {
    const record: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const sanitized = sanitizePowerFxValue(child);
      if (sanitized !== undefined) record[key] = sanitized;
    }
    return record;
  }
  return undefined;
}

async function powerFxAvailable(): Promise<boolean> {
  if (!displayEngine) displayEngine = createDefaultFormulaEngine();
  if (!displayEngineReady) {
    const engine = displayEngine;
    displayEngineReady = engine.initialize().then(() => true).catch(() => false);
  }
  return displayEngineReady;
}

/**
 * Evaluates a property value formula.
 * Uses the Power Fx service when it is up, and surfaces that engine's errors.
 * The session engine is only used when the Power Fx service cannot be reached.
 */
export async function evaluateDisplayFormula(
  formula: string,
  context: Record<string, unknown> | undefined,
  sessionEngine: FormulaEngine,
): Promise<unknown> {
  if (await powerFxAvailable()) {
    return displayEngine!.evaluate(formula, powerFxContext(context));
  }
  return sessionEngine.evaluate(formula, context);
}
