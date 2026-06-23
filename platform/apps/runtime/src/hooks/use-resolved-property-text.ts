import { useEffect, useState } from "react";
import {
  readStaticPropertyValue,
  resolvePropertyValue,
} from "@goapps/formula";
import { useFormulaEngine, useFormulaEvaluationContext } from "../formula/formula-context";

export function useResolvedPropertyText(
  property: unknown,
  fallback = "",
): string {
  const engine = useFormulaEngine();
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
