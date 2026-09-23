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
import { useRuntime } from "../runtime-hooks";
import {
  fetchRuntimeForm,
  updateRuntimeForm,
  type RuntimeFormState,
} from "../runtime-session-client";
import { registerFormUpdateFlusher } from "../formula/form-update-flush";
import { fillParentStyle, relativeContainerStyle, resolveDisplayMode } from "../utils/control-layout";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
import type { ControlPackage } from "../runtime-types";

function readItemFormula(property: unknown): string {
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    return typeof formula === "string" ? formula.trim() : "";
  }
  return "";
}

function normalizeFormModeInput(mode: unknown): string {
  if (mode == null) return "";
  if (typeof mode === "string") return mode.trim();
  if (mode && typeof mode === "object" && "value" in mode) {
    return String((mode as { value?: unknown }).value ?? "").trim();
  }
  return "";
}

function normalizeFormMode(mode: unknown, fallback: "View" | "Edit" | "New" = "View"): "View" | "Edit" | "New" {
  const normalized = normalizeFormModeInput(mode).toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "edit" || normalized.startsWith("edit")) return "Edit";
  if (normalized === "new" || normalized.startsWith("new")) return "New";
  if (normalized === "view" || normalized.startsWith("view")) return "View";
  return fallback;
}

function readModeValue(mode: unknown): "View" | "Edit" | "New" {
  return normalizeFormMode(mode, "Edit");
}

function normalizeMode(mode: string | undefined): "View" | "Edit" | "New" {
  return normalizeFormMode(mode, "View");
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

function recordIdentityKey(
  record: Record<string, unknown> | null,
  formMode: string,
): string | null {
  if (!record) return null;
  // Prefer platform identity only — avoid generic `id`/`Id` business fields.
  const id = record.recordId ?? record.RecordId ?? null;
  if (id != null && String(id).trim() !== "") {
    return `${formMode}:${String(id)}`;
  }
  if (formMode === "New") return "New";
  return `${formMode}:empty`;
}

export const Form: React.FC<{
  name?: string;
  controlId?: string;
  item?: unknown;
  mode?: unknown;
  templateControls?: ControlPackage[];
  disabled?: boolean;
  readOnly?: boolean;
  layout?: unknown;
  columns?: unknown;
  displayMode?: unknown;
  tooltip?: unknown;
}> = ({
  name,
  controlId,
  item,
  mode,
  templateControls = [],
  disabled = false,
  readOnly = false,
  layout,
  columns,
  displayMode,
  tooltip,
}) => {
  const engine = useFormulaEngine();
  const context = useFormulaEvaluationContext();
  const formUpdatesStore = useFormUpdatesStore();
  const isStudioCanvas = useIsDesignSurface();
  const {
    appId,
    sessionId,
    formRefreshTick = 0,
    runtimeUnavailable,
  } = useRuntime();

  const packageMode = readModeValue(mode);
  const formName = name?.trim() ?? "";
  const [sessionState, setSessionState] = useState<RuntimeFormState | null>(null);
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const lastInitializedRecordKey = useRef<string | null>(null);
  const pendingFieldsRef = useRef<Record<string, unknown>>({});
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sessionMode = sessionState ? normalizeMode(sessionState.mode) : null;
  const formMode = sessionMode ?? packageMode;
  const identityKey = recordIdentityKey(record, formMode);
  const isEditLike = formMode === "Edit" || formMode === "New";
  const chromeMode = resolveDisplayMode(displayMode);
  const resolvedTooltip = useResolvedPropertyText(tooltip);
  const isReadOnly =
    readOnly || disabled || formMode === "View" || chromeMode === "View" || chromeMode === "Disabled";
  const hasSession = Boolean(sessionId && appId && controlId && !runtimeUnavailable);

  const applySessionState = useCallback(
    (state: RuntimeFormState) => {
      setSessionState(state);
      const nextMode = normalizeMode(state.mode);
      const nextRecord =
        state.currentRecord && typeof state.currentRecord === "object"
          ? { ...state.currentRecord }
          : {};
      setRecord(nextMode === "New" ? nextRecord : nextRecord);
      if (formName) {
        formUpdatesStore.set(formName, { ...(state.dirtyFields ?? nextRecord) });
      }
    },
    [formName, formUpdatesStore],
  );

  const refreshSessionForm = useCallback(async () => {
    if (!hasSession || !sessionId || !controlId) return;
    setLoading(true);
    try {
      const state = await fetchRuntimeForm({ sessionId, controlId });
      applySessionState(state);
    } catch {
      // Fall back to client item evaluation when form APIs are unavailable.
    } finally {
      setLoading(false);
    }
  }, [applySessionState, controlId, hasSession, sessionId]);

  useEffect(() => {
    void refreshSessionForm();
  }, [refreshSessionForm, formRefreshTick]);

  useEffect(() => {
    if (hasSession) return;
    if (formMode === "New") {
      setRecord({});
      return;
    }

    let cancelled = false;
    const formula = readItemFormula(item);
    if (!formula) {
      setRecord(null);
      return;
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
  }, [item, engine, context, formMode, hasSession]);

  useEffect(() => {
    if (!isEditLike || !formName || !record || !identityKey || isReadOnly) {
      return;
    }
    if (lastInitializedRecordKey.current === identityKey) return;
    lastInitializedRecordKey.current = identityKey;
    formUpdatesStore.set(formName, { ...record });
  }, [isEditLike, formMode, formName, record, identityKey, formUpdatesStore, isReadOnly]);

  const flushPendingUpdates = useCallback(async () => {
    if (!hasSession || !sessionId || !appId || !controlId) return;
    const fields = pendingFieldsRef.current;
    if (Object.keys(fields).length === 0) return;
    pendingFieldsRef.current = {};
    try {
      const state = await updateRuntimeForm({
        appId,
        sessionId,
        controlId,
        fields,
      });
      applySessionState(state);
    } catch {
      // Keep local updates; submit may still fail with a clear error.
    }
  }, [appId, applySessionState, controlId, hasSession, sessionId]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  const reportUpdate = useCallback(
    (field: string, value: unknown) => {
      if (!formName || isReadOnly) return;
      formUpdatesStore.updateField(formName, field, value);
      setRecord((prev) => ({ ...(prev ?? {}), [field]: value }));
      if (!hasSession || !sessionId || !appId || !controlId) return;
      pendingFieldsRef.current = { ...pendingFieldsRef.current, [field]: value };
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => {
        void flushPendingUpdates();
      }, 200);
    },
    [
      appId,
      controlId,
      flushPendingUpdates,
      formName,
      formUpdatesStore,
      hasSession,
      isReadOnly,
      sessionId,
    ],
  );

  useEffect(() => {
    const key = controlId || formName;
    if (!key) return;
    return registerFormUpdateFlusher(key, flushPendingUpdates);
  }, [controlId, flushPendingUpdates, formName]);

  useEffect(() => {
    // Only steal focus after Submit validation failure — never on debounced field Updates.
    const submitFailed =
      sessionState?.error &&
      typeof sessionState.error === "object" &&
      String((sessionState.error as { message?: unknown }).message ?? "")
        .toLowerCase()
        .includes("validation");
    if (!submitFailed) return;
    const errors = sessionState?.validationErrors ?? [];
    if (errors.length === 0) return;
    const target = document.querySelector<HTMLElement>(
      '[aria-invalid="true"], [data-required="true"][aria-invalid="true"]',
    );
    target?.focus?.();
  }, [sessionState?.error, sessionState?.validationErrors]);

  const inputIdForField = useCallback(
    (fieldName: string) =>
      `form-${controlId || formName || "form"}-field-${fieldName}`,
    [controlId, formName],
  );

  const editContextValue = useMemo(
    () => ({
      reportUpdate,
      flushPendingUpdates,
      validationErrors: sessionState?.validationErrors ?? [],
      formMode,
      isReadOnly,
      recordKey: identityKey,
      inputIdForField,
    }),
    [
      flushPendingUpdates,
      formMode,
      identityKey,
      inputIdForField,
      isReadOnly,
      reportUpdate,
      sessionState?.validationErrors,
    ],
  );

  const layoutValue =
    layout && typeof layout === "object" && "value" in layout
      ? String((layout as { value?: unknown }).value ?? "")
      : typeof layout === "string"
        ? layout
        : "";
  const columnsValue = Number(
    columns && typeof columns === "object" && "value" in columns
      ? (columns as { value?: unknown }).value
      : columns,
  );
  const useColumns =
    layoutValue.toLowerCase() === "columns" &&
    Number.isFinite(columnsValue) &&
    columnsValue > 1;

  if (isStudioCanvas) {
    if (formMode === "New") return <div>New Form</div>;
    return <div>{formMode === "Edit" ? "Edit Form" : "Display Form"}</div>;
  }

  if (loading && record === null) {
    return <div data-testid="form-loading">Loading form…</div>;
  }

  const resolvedRecord = record ?? {};
  const recordIsEmpty = Object.keys(resolvedRecord).length === 0;
  if (formMode === "View" && recordIsEmpty) {
    return <div data-testid="form-empty">No Record</div>;
  }

  const children = templateControls.map((control) => (
    <ControlRenderer key={control.id} control={control} nested />
  ));

  const verticalStyle: React.CSSProperties = {
    ...relativeContainerStyle(),
    display: "flex",
    flexDirection: "column",
    gap: 12,
    overflow: "auto",
    padding: 8,
  };

  const containerStyle: React.CSSProperties = useColumns
    ? ({
        ...relativeContainerStyle(),
        display: "grid",
        gridTemplateColumns: `repeat(${columnsValue}, minmax(0, 1fr))`,
        gap: 12,
        overflow: "auto",
        padding: 8,
        containerType: "inline-size",
      } as React.CSSProperties)
    : layoutValue.toLowerCase() === "horizontal"
      ? {
          ...relativeContainerStyle(),
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          overflow: "auto",
          padding: 8,
        }
      : verticalStyle;

  const formErrorMessage =
    sessionState?.error && typeof sessionState.error === "object"
      ? String((sessionState.error as { message?: unknown }).message ?? "")
      : "";

  const offlineHint =
    !hasSession && !isStudioCanvas
      ? runtimeUnavailable
        ? "Runtime service unavailable — edits stay local and will not persist to the database."
        : !sessionId
          ? "No runtime session — form Submit uses offline memory only until a session is connected."
          : null
      : null;

  const formBody = (
    <div
      style={containerStyle}
      data-testid={isEditLike && !isReadOnly ? "form-edit" : "form-view"}
      data-layout={layoutValue || "Vertical"}
      data-form-mode={formMode}
      role="form"
      aria-busy={loading || undefined}
      aria-invalid={Boolean(formErrorMessage) || undefined}
    >
      {useColumns ? (
        <style>{`
          @container (max-width: 520px) {
            [data-testid="form-edit"][data-layout="Columns"],
            [data-testid="form-view"][data-layout="Columns"] {
              grid-template-columns: 1fr !important;
            }
          }
          @container (max-width: 720px) and (min-width: 521px) {
            [data-testid="form-edit"][data-layout="Columns"],
            [data-testid="form-view"][data-layout="Columns"] {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
          }
        `}</style>
      ) : null}
      {offlineHint ? (
        <div
          role="status"
          data-testid="form-offline-hint"
          style={{
            color: "#92400e",
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: 4,
            fontSize: 12,
            padding: "6px 8px",
            marginBottom: 6,
          }}
        >
          {offlineHint}
        </div>
      ) : null}
      {formErrorMessage ? (
        <div role="alert" style={{ color: "#b91c1c", fontSize: 12, marginBottom: 4 }}>
          {formErrorMessage}
        </div>
      ) : null}
      {templateControls.length > 0
        ? children
        : Object.entries(record ?? {}).map(([field, value]) => (
            <div key={field} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{field}</span>
              <span>{stringifyFieldValue(value)}</span>
            </div>
          ))}
    </div>
  );

  return (
    <FormEditContext.Provider value={editContextValue}>
      <FormItemProvider item={resolvedRecord}>
        <div title={resolvedTooltip || undefined} style={{ ...fillParentStyle(), overflow: "auto" }}>{formBody}</div>
      </FormItemProvider>
    </FormEditContext.Provider>
  );
};

export default Form;
