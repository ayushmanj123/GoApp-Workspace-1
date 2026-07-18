import type { RuntimeFormula } from "../runtime-types";

export function mergeFormulasIntoProps(
  properties: Record<string, unknown>,
  formulas: RuntimeFormula[] | undefined,
): Record<string, unknown> {
  const merged = { ...properties };
  for (const formula of formulas ?? []) {
    const name = formula.property_name?.trim();
    const text = formula.formula_text?.trim();
    if (!name || !text) {
      continue;
    }
    if (formula.formula_type === "behavior" || merged[name] === undefined) {
      merged[name] = { formula: text };
    }
  }
  return merged;
}
