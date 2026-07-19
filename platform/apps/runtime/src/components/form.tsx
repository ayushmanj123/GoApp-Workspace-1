import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ControlRenderer from "../control-renderer";
import {
  FormItemProvider,
  useFormulaEngine,
  useFormulaEvaluationContext,
  useFormUpdatesStore,
} from "../formula/formula-context";
import { FormEditContext } from "../form-edit-context";
import { useIsDesignSurface } from "../design-mode-context";
import { fillParentStyle, relativeContainerStyle } from "../utils/control-layout";
import type { ControlPackage } from "../runtime-types";

function readItemFormula(property: unknown): string {
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    return typeof formula === "string" ? formula.trim() : "";
  }
  return "";
}

function readModeValue(mode: unknown): "View" | "Edit" | "New" {
  if (mode && typeof mode === "object" && "value" in mode) {
    const value = String((mode as { value?: unknown }).value ?? "").trim();
    const normalized = value.toLowerCase();
    if (normalized === "edit") return "Edit";
    if (normalized === "new") return "New";
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
  disabled?: boolean;
  readOnly?: boolean;
}> = ({
  name,
  item,
  mode,
  templateControls = [],
  disabled = false,
  readOnly = false,
}) => {
  const engine = useFormulaEngine();
  const context = useFormulaEvaluationContext();
  const formUpdatesStore = useFormUpdatesStore();
  const isStudioCanvas = useIsDesignSurface();
  const formMode = readModeValue(mode);
  const formName = name?.trim() ?? "";
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const lastInitializedRecordKey = useRef<string | null>(null);
  const recordKey = record ? JSON.stringify(record) : null;
  const isEditLike = formMode === "Edit" || formMode === "New";
  const isReadOnly = readOnly || disabled || formMode === "View";

  useEffect(() => {
    if (formMode === "New") {
      setRecord({});
      return;
    }

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
  }, [item, engine, context, formMode]);

  useEffect(() => {
    if (!isEditLike || !formName || !record || !recordKey || isReadOnly) {
      return;
    }
    if (lastInitializedRecordKey.current === recordKey) return;
    lastInitializedRecordKey.current = recordKey;
    formUpdatesStore.set(formName, { ...record });
  }, [isEditLike, formMode, formName, record, recordKey, formUpdatesStore, isReadOnly]);

  const reportUpdate = useCallback(
    (field: string, value: unknown) => {
      if (!formName || isReadOnly) return;
      formUpdatesStore.updateField(formName, field, value);
    },
    [formName, formUpdatesStore, isReadOnly],
  );

  const editContextValue = useMemo(
    () => ({ reportUpdate }),
    [reportUpdate],
  );

  if (isStudioCanvas) {
    if (formMode === "New") {
      return <div>New Form</div>;
    }
    return <div>{formMode === "Edit" ? "Edit Form" : "Display Form"}</div>;
  }

  if (!record || (formMode !== "New" && Object.keys(record).length === 0)) {
    return <div>No Record</div>;
  }

  if (isEditLike && !isReadOnly) {
    return (
      <FormEditContext.Provider value={editContextValue}>
        <FormItemProvider item={record}>
          <div style={{ ...relativeContainerStyle(), overflow: "auto" }}>
            {templateControls.map((control) => (
              <ControlRenderer key={control.id} control={control} nested />
            ))}
          </div>
        </FormItemProvider>
      </FormEditContext.Provider>
    );
  }

  return (
    <div style={{ ...fillParentStyle(), overflow: "auto", padding: 4 }}>
      {templateControls.length > 0 ? (
        <div style={relativeContainerStyle()}>
          {templateControls.map((control) => (
            <ControlRenderer key={control.id} control={control} nested />
          ))}
        </div>
      ) : (
        Object.entries(record).map(([field, value]) => (
          <div key={field}>
            {field}: {stringifyFieldValue(value)}
          </div>
        ))
      )}
    </div>
  );
};

export default Form;
