import type { FormulaEngine } from "@goapps/formula";
import type { RuntimeVariableStore } from "./runtime-variable-store";

/**
 * Finds the index of the first comma at depth 0, accounting for
 * nested parentheses and double-quoted strings.
 */
function findFirstTopLevelComma(s: string): number {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
    } else if (c === "(") {
      depth++;
    } else if (c === ")") {
      depth--;
    } else if (c === "," && depth === 0) {
      return i;
    }
  }
  return -1;
}

export interface ParsedSet {
  varName: string;
  valueExpr: string;
}

/**
 * Parses a Power Fx Set() formula into its target variable name and
 * value expression. Returns null for anything that is not a valid Set().
 */
export function parseSetFormula(formula: string): ParsedSet | null {
  const trimmed = formula.trim();
  if (!/^Set\s*\(/i.test(trimmed)) return null;

  const openParen = trimmed.indexOf("(");
  const lastParen = trimmed.lastIndexOf(")");
  if (openParen === -1 || lastParen <= openParen) return null;

  const content = trimmed.slice(openParen + 1, lastParen).trim();
  const commaIdx = findFirstTopLevelComma(content);
  if (commaIdx === -1) return null;

  const varName = content.slice(0, commaIdx).trim();
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(varName)) return null;

  const valueExpr = content.slice(commaIdx + 1).trim();
  if (!valueExpr) return null;

  return { varName, valueExpr };
}

/**
 * Executes a Set(varName, valueExpr) formula:
 * 1. Parses the Set() call
 * 2. Evaluates the value expression via the formula engine
 * 3. Writes the result to the store (notifying subscribers)
 */
export async function executeSet(
  formula: string,
  store: RuntimeVariableStore,
  engine: FormulaEngine,
  context: Record<string, unknown>,
): Promise<void> {
  const parsed = parseSetFormula(formula);
  if (!parsed) {
    throw new Error(`Invalid Set() formula: ${formula}`);
  }
  const value = await engine.evaluate(parsed.valueExpr, context);
  store.set(parsed.varName, value);
}
