import { useMemo } from "react";
import { useFormulaEvaluationContext } from "../formula/formula-context";
import { parseParentItemField } from "../utils/parent-item-field";

function readPropertyFormula(property: unknown): string {
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    return typeof formula === "string" ? formula.trim() : "";
  }
  return "";
}

function readParentItemFieldValue(
  context: Record<string, unknown>,
  field: string,
): string {
  const parent = context.Parent;
  if (!parent || typeof parent !== "object") return "";
  const item = (parent as { Item?: unknown }).Item;
  if (!item || typeof item !== "object" || Array.isArray(item)) return "";
  const value = (item as Record<string, unknown>)[field];
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

/** Resolves Parent.Item.Field from the scoped formula evaluation context. */
export function useParentItemDefault(property: unknown): string {
  const context = useFormulaEvaluationContext();
  const formula = readPropertyFormula(property);
  const field = parseParentItemField(formula);

  return useMemo(() => {
    if (!field) return "";
    return readParentItemFieldValue(context, field);
  }, [context, field]);
}
