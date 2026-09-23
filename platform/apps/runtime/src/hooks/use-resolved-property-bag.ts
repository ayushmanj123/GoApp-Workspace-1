import { useEffect, useState } from "react";
import { useFormulaEngine, useFormulaEvaluationContext } from "../formula/formula-context";
import { evaluateDisplayFormula } from "../formula/evaluate-display-formula";

const SKIP_KEYS = new Set([
  "items",
  "item",
  "default",
  "filter",
  "sort",
  "update",
  "columns",
  "datasource",
]);

function isFormulaEntry(value: unknown): value is { formula: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "formula" in value &&
      typeof (value as { formula?: unknown }).formula === "string",
  );
}

/**
 * Replaces value-formula properties with their evaluated results.
 * Action formulas (OnSelect and other On* events) and data-binding
 * formulas stay as `{ formula }` so their handlers can run them.
 */
export function useResolvedPropertyBag(
  source: Record<string, unknown>,
): Record<string, unknown> {
  const engine = useFormulaEngine();
  const context = useFormulaEvaluationContext();
  const [resolved, setResolved] = useState(source);
  const signature = JSON.stringify(source);

  useEffect(() => {
    let cancelled = false;
    const current = JSON.parse(signature) as Record<string, unknown>;
    void (async () => {
      const next: Record<string, unknown> = { ...current };
      await Promise.all(
        Object.entries(current).map(async ([key, value]) => {
          const lower = key.toLowerCase();
          if (lower.startsWith("on") || SKIP_KEYS.has(lower)) return;
          if (!isFormulaEntry(value) || !value.formula.trim()) return;
          try {
            next[key] = await evaluateDisplayFormula(value.formula, context, engine);
          } catch (error) {
            console.error("[formula] property evaluation failed:", error);
          }
        }),
      );
      if (!cancelled) setResolved(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [signature, engine, context]);

  return resolved;
}
