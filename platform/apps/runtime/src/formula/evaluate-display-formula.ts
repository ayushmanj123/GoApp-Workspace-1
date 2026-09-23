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

async function tryPowerFx(
  formula: string,
  context?: Record<string, unknown>,
): Promise<unknown> {
  if (!displayEngine) displayEngine = createDefaultFormulaEngine();
  if (!displayEngineReady) {
    const engine = displayEngine;
    displayEngineReady = engine.initialize().then(() => true).catch(() => false);
  }
  if (!(await displayEngineReady)) {
    throw new Error("Power Fx display engine is unavailable.");
  }
  return displayEngine.evaluate(formula, powerFxContext(context));
}

/**
 * Evaluates a property value formula.
 * Prefers the Power Fx service (same engine the formula editor validates against),
 * then the runtime session engine with the full client context.
 */
export async function evaluateDisplayFormula(
  formula: string,
  context: Record<string, unknown> | undefined,
  sessionEngine: FormulaEngine,
): Promise<unknown> {
  try {
    return await tryPowerFx(formula, context);
  } catch {
    return sessionEngine.evaluate(formula, context);
  }
}
