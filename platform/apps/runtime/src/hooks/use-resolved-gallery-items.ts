import { useEffect, useMemo, useState } from "react";
import {
  useFormulaEngine,
  useFormulaEvaluationContext,
} from "../formula/formula-context";
import {
  normalizeGalleryRecords,
  normalizeGalleryRows,
  readItemsFormula,
} from "../utils/gallery-rows";

function isBareCollectionReference(formula: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*$/.test(formula);
}

function asRecordArray(value: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(value)) return null;
  return normalizeGalleryRecords(value);
}

export function useResolvedGalleryRecords(
  items: unknown,
): Record<string, unknown>[] {
  const engine = useFormulaEngine();
  const context = useFormulaEvaluationContext();

  // Pre-evaluated array (render payload or static).
  const arrayRecords = useMemo(() => asRecordArray(items), [items]);

  const formula = readItemsFormula(items);
  const isDirectCollection =
    Boolean(formula) && isBareCollectionReference(formula);

  const directRecords = useMemo(() => {
    if (!isDirectCollection || !formula) {
      return [] as Record<string, unknown>[];
    }
    const value = context[formula];
    return Array.isArray(value) ? normalizeGalleryRecords(value) : [];
  }, [isDirectCollection, formula, context]);

  const [computedRecords, setComputedRecords] = useState<
    Record<string, unknown>[]
  >([]);

  useEffect(() => {
    if (arrayRecords || isDirectCollection) {
      return;
    }

    let cancelled = false;

    if (!formula) {
      setComputedRecords([]);
      return () => {
        cancelled = true;
      };
    }

    void engine
      .evaluate(formula, context)
      .then((result) => {
        if (!cancelled) {
          setComputedRecords(normalizeGalleryRecords(result));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setComputedRecords([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [items, engine, context, formula, isDirectCollection, arrayRecords]);

  if (arrayRecords) return arrayRecords;
  if (isDirectCollection) return directRecords;
  return computedRecords;
}

export function useResolvedGalleryItems(items: unknown): string[] {
  const engine = useFormulaEngine();
  const context = useFormulaEvaluationContext();
  const [rows, setRows] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const asArray = asRecordArray(items);
    if (asArray) {
      setRows(normalizeGalleryRows(asArray));
      return () => {
        cancelled = true;
      };
    }
    const formula = readItemsFormula(items);

    if (!formula) {
      setRows([]);
      return () => {
        cancelled = true;
      };
    }

    void engine
      .evaluate(formula, context)
      .then((result) => {
        if (!cancelled) {
          setRows(normalizeGalleryRows(result));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [items, engine, context]);

  return rows;
}
