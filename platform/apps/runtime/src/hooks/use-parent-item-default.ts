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
  const fromRecord = (record: unknown): string => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return "";
    const value = (record as Record<string, unknown>)[field];
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return "";
  };

  const thisItem = fromRecord(context.ThisItem);
  if (thisItem !== "") return thisItem;

  const parent = context.Parent;
  if (!parent || typeof parent !== "object") return "";
  return fromRecord((parent as { Item?: unknown }).Item);
}

/** Resolves Parent.Item.Field or ThisItem.Field from the scoped formula evaluation context. */
export function useParentItemDefault(property: unknown): string {
  const context = useFormulaEvaluationContext();
  const formula = readPropertyFormula(property);
  const field = parseParentItemField(formula);

  return useMemo(() => {
    if (!field) return "";
    return readParentItemFieldValue(context, field);
  }, [context, field]);
}
