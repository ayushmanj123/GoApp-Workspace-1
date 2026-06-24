import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ControlRenderer from "../control-renderer";
import {
  FormItemProvider,
  useFormulaEngine,
  useFormulaEvaluationContext,
  useFormUpdatesStore,
} from "../formula/formula-context";
import { FormEditContext } from "../form-edit-context";
import { useNavigationStore } from "../runtime-hooks";
import type { ControlPackage } from "../runtime-types";

function readItemFormula(property: unknown): string {
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    return typeof formula === "string" ? formula.trim() : "";
  }
  return "";
}

function readModeValue(mode: unknown): "View" | "Edit" {
  if (mode && typeof mode === "object" && "value" in mode) {
    const value = String((mode as { value?: unknown }).value ?? "").trim();
    if (value.toLowerCase() === "edit") return "Edit";
  }
  return "View";
}

function stringifyFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const Form: React.FC<{
  name?: string;
  item?: unknown;
  mode?: unknown;
  templateControls?: ControlPackage[];
}> = ({ name, item, mode, templateControls = [] }) => {
  const engine = useFormulaEngine();
  const context = useFormulaEvaluationContext();
  const navigationStore = useNavigationStore();
  const formUpdatesStore = useFormUpdatesStore();
  const isStudioCanvas = navigationStore === null;
  const formMode = readModeValue(mode);
  const formName = name?.trim() ?? "";
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const lastInitializedRecordKey = useRef<string | null>(null);
  const recordKey = record ? JSON.stringify(record) : null;

  useEffect(() => {
    let cancelled = false;
    const formula = readItemFormula(item);
    if (!formula) {
      setRecord(null);
      return () => {
        cancelled = true;
      };
    }

    void engine
      .evaluate(formula, context)
      .then((result) => {
        if (cancelled) return;
        if (result && typeof result === "object" && !Array.isArray(result)) {
          setRecord(result as Record<string, unknown>);
        } else {
          setRecord(null);
        }
      })
      .catch(() => {
        if (!cancelled) setRecord(null);
      });

    return () => {
      cancelled = true;
    };
  }, [item, engine, context]);

  useEffect(() => {
    if (formMode !== "Edit" || !formName || !record || !recordKey) return;
    if (lastInitializedRecordKey.current === recordKey) return;
    lastInitializedRecordKey.current = recordKey;
    formUpdatesStore.set(formName, { ...record });
  }, [formMode, formName, record, recordKey, formUpdatesStore]);

  const reportUpdate = useCallback(
    (field: string, value: unknown) => {
      if (!formName) return;
      formUpdatesStore.updateField(formName, field, value);
    },
    [formName, formUpdatesStore],
  );

  const editContextValue = useMemo(
    () => ({ reportUpdate }),
    [reportUpdate],
  );

  if (isStudioCanvas) {
    return <div>{formMode === "Edit" ? "Edit Form" : "Display Form"}</div>;
  }

  if (!record || Object.keys(record).length === 0) {
    return <div>No Record</div>;
  }

  if (formMode === "Edit") {
    return (
      <FormEditContext.Provider value={editContextValue}>
        <FormItemProvider item={record}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              width: "100%",
              height: "100%",
              overflow: "auto",
              boxSizing: "border-box",
            }}
          >
            {templateControls.map((control) => (
              <ControlRenderer key={control.id} control={control} />
            ))}
          </div>
        </FormItemProvider>
      </FormEditContext.Provider>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {Object.entries(record).map(([field, value]) => (
        <div key={field}>
          {field}: {stringifyFieldValue(value)}
        </div>
      ))}
    </div>
  );
};

export default Form;
