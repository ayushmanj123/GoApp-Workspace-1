import { useEffect, useState } from "react";
import { LiteralFormulaEngine } from "@goapps/formula";
import type { Control } from "../../api/controls-api";
import { evaluateDisplayFormula } from "../../../../runtime/src/formula/evaluate-display-formula";
import { buildStudioFormulaContext } from "../../utils/build-studio-formula-context";

export interface DesignerFormulaEntry {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  visible?: boolean;
  properties: Record<string, unknown>;
}

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

let cache = new Map<string, DesignerFormulaEntry>();
const listeners = new Set<() => void>();

function publish(next: Map<string, DesignerFormulaEntry>) {
  cache = next;
  for (const listener of listeners) listener();
}

export function designerFormulaEntry(controlId: string): DesignerFormulaEntry | undefined {
  return cache.get(controlId);
}

export function designerMetric(
  control: { id: string; x: number; y: number; width: number; height: number },
  key: "x" | "y" | "width" | "height",
): number {
  const resolved = cache.get(control.id)?.[key];
  if (typeof resolved === "number" && Number.isFinite(resolved)) return resolved;
  return control[key];
}

function isFormulaEntry(value: unknown): value is { formula: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "formula" in value &&
      typeof (value as { formula?: unknown }).formula === "string" &&
      String((value as { formula: string }).formula).trim(),
  );
}

export function useDesignerFormulaSync(controls: Control[], appName: string): number {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const context = buildStudioFormulaContext(appName, controls);
    const literal = new LiteralFormulaEngine();

    void (async () => {
      const next = new Map<string, DesignerFormulaEntry>();
      for (const control of controls) {
        const properties = { ...(control.properties ?? {}) };
        const entry: DesignerFormulaEntry = { properties };
        for (const [key, value] of Object.entries(properties)) {
          const lower = key.toLowerCase();
          if (lower.startsWith("on") || SKIP_KEYS.has(lower)) continue;
          if (!isFormulaEntry(value)) continue;
          try {
            properties[key] = await evaluateDisplayFormula(value.formula, context, literal);
          } catch {
            /* keep the formula wrapper so the canvas can show the expression */
          }
        }
        for (const key of ["x", "y", "width", "height"] as const) {
          const raw = properties[key];
          const parsed = typeof raw === "number" ? raw : Number(raw);
          if (Number.isFinite(parsed)) entry[key] = parsed;
        }
        const visibleRaw = properties.visible ?? properties.Visible;
        if (typeof visibleRaw === "boolean") entry.visible = visibleRaw;
        else if (typeof visibleRaw === "string") {
          entry.visible = visibleRaw.trim().toLowerCase() !== "false";
        }
        next.set(control.id, entry);
      }
      if (!cancelled) {
        publish(next);
        setRevision((value) => value + 1);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [controls, appName]);

  useEffect(() => {
    const listener = () => setRevision((value) => value + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return revision;
}
