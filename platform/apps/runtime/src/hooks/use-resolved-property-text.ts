import { useEffect, useMemo, useState } from "react";
import {
  readStaticPropertyValue,
  resolvePropertyValue,
  type FormulaEngine,
} from "@goapps/formula";
import { useFormulaEngine, useFormulaEvaluationContext } from "../formula/formula-context";
import { evaluateDisplayFormula } from "../formula/evaluate-display-formula";

export function useResolvedPropertyText(
  property: unknown,
  fallback = "",
): string {
  const sessionEngine = useFormulaEngine();
  const engine = useMemo<FormulaEngine>(
    () => ({
      initialize: () => sessionEngine.initialize(),
      evaluate: (formula, context) =>
        evaluateDisplayFormula(formula, context, sessionEngine),
    }),
    [sessionEngine],
  );
  const context = useFormulaEvaluationContext();
  const [displayValue, setDisplayValue] = useState(() =>
    readStaticPropertyValue(property, fallback),
  );

  useEffect(() => {
    let cancelled = false;

    void resolvePropertyValue(property, engine, fallback, context).then((resolved) => {
      if (!cancelled) {
        setDisplayValue(resolved);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [property, engine, fallback, context]);

  return displayValue;
}

/** Formula or static property coerced to a finite number. */
export function useResolvedNumber(property: unknown): number | undefined {
  const text = useResolvedPropertyText(property, "");
  if (!text || text === "[Formula Error]") return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Formula or static property coerced to a boolean. */
export function useResolvedBoolean(property: unknown, fallback: boolean): boolean {
  const text = useResolvedPropertyText(property, "");
  if (!text || text === "[Formula Error]") {
    if (typeof property === "boolean") return property;
    return fallback;
  }
  const lower = text.trim().toLowerCase();
  if (lower === "true" || lower === "1") return true;
  if (lower === "false" || lower === "0") return false;
  return fallback;
}
