import React, { useMemo } from "react";
import ControlRenderer from "../control-renderer";
import { FormEditContext, useFormEditContext } from "../form-edit-context";
import { FormItemProvider, useFormulaEvaluationContext } from "../formula/formula-context";
import { resolveDisplayMode } from "../utils/control-layout";
import type { ControlPackage } from "../runtime-types";

function readTextProp(property: unknown): string {
  if (typeof property === "string") return property.trim();
  if (property && typeof property === "object" && "value" in property) {
    return String((property as { value?: unknown }).value ?? "").trim();
  }
  if (property && typeof property === "object" && "formula" in property) {
    return String((property as { formula?: unknown }).formula ?? "").trim();
  }
  return "";
}

function readBoolProp(property: unknown): boolean {
  if (typeof property === "boolean") return property;
  if (property && typeof property === "object" && "value" in property) {
    return Boolean((property as { value?: unknown }).value);
  }
  return false;
}

export const DataCard: React.FC<{
  name?: string;
  dataField?: unknown;
  required?: unknown;
  displayMode?: unknown;
  visible?: unknown;
  templateControls?: ControlPackage[];
  disabled?: boolean;
  readOnly?: boolean;
}> = ({
  name,
  dataField,
  required,
  displayMode,
  visible,
  templateControls = [],
  disabled = false,
  readOnly = false,
}) => {
  const formEdit = useFormEditContext();
  const context = useFormulaEvaluationContext();
  const fieldName = readTextProp(dataField);
  const isRequired = readBoolProp(required);
  const visibleValue = visible === undefined ? true : readBoolProp(visible);
  if (!visibleValue) return null;

  const inheritedMode = formEdit?.formMode === "View" ? "View" : "Edit";
  const cardMode = resolveDisplayMode(displayMode) ?? inheritedMode;
  const cardReadOnly =
    readOnly ||
    disabled ||
    cardMode === "View" ||
    cardMode === "Disabled" ||
    Boolean(formEdit?.isReadOnly);
  const errors = (formEdit?.validationErrors ?? []).filter(
    (issue) =>
      !fieldName ||
      !issue.field ||
      issue.field.toLowerCase() === fieldName.toLowerCase(),
  );

  const inputId =
    fieldName && formEdit?.inputIdForField
      ? formEdit.inputIdForField(fieldName)
      : fieldName
        ? `datacard-${fieldName}`
        : undefined;

  const style: React.CSSProperties = {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minHeight: 64,
    marginBottom: 0,
    padding: "8px 10px",
    boxSizing: "border-box",
    width: "100%",
    border: "1px solid #d8d8d8",
    borderRadius: 6,
    background: cardReadOnly ? "#f7f7f8" : "#fafafa",
    opacity: cardMode === "Disabled" ? 0.6 : 1,
    pointerEvents: cardMode === "Disabled" ? "none" : undefined,
  };

  const thisItem =
    context.ThisItem && typeof context.ThisItem === "object"
      ? (context.ThisItem as Record<string, unknown>)
      : {};

  const cardEditContext = useMemo(() => {
    if (!formEdit) {
      return {
        reportUpdate: () => {},
        isReadOnly: cardReadOnly,
        formMode: cardMode === "View" ? ("View" as const) : ("Edit" as const),
        validationErrors: errors,
        inputIdForField: (field: string) =>
          inputId && field.toLowerCase() === fieldName.toLowerCase()
            ? inputId
            : `field-${field}`,
      };
    }
    return {
      ...formEdit,
      isReadOnly: cardReadOnly,
      formMode:
        cardMode === "View"
          ? ("View" as const)
          : formEdit.formMode === "New"
            ? ("New" as const)
            : ("Edit" as const),
    };
  }, [cardMode, cardReadOnly, errors, fieldName, formEdit, inputId]);

  const content = useMemo(() => {
    const labels = templateControls.filter((c) => {
      const t = String(c.control_type ?? "").toLowerCase();
      return t === "label";
    });
    const inputs = templateControls.filter((c) => {
      const t = String(c.control_type ?? "").toLowerCase();
      return t !== "label";
    });
    const ordered = [...labels, ...inputs];
    return ordered.map((control) => {
      const t = String(control.control_type ?? "").toLowerCase();
      const isLabel = t === "label";
      return (
        <div
          key={control.id}
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: isLabel ? 18 : 32,
            width: "100%",
          }}
        >
          <ControlRenderer
            control={control}
            nested
            forceReadOnly={cardReadOnly}
            inputId={!isLabel ? inputId : undefined}
          />
        </div>
      );
    });
  }, [cardReadOnly, inputId, templateControls]);

  return (
    <div
      style={style}
      data-testid={`data-card-${name || fieldName || "field"}`}
      data-required={isRequired ? "true" : "false"}
      data-display-mode={cardMode}
      aria-invalid={errors.length > 0}
      tabIndex={errors.length > 0 ? -1 : undefined}
    >
      {isRequired ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 8,
            right: 10,
            color: "#b91c1c",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          *
        </span>
      ) : null}
      <FormEditContext.Provider value={cardEditContext}>
        <FormItemProvider item={thisItem}>{content}</FormItemProvider>
      </FormEditContext.Provider>
      {errors.length > 0 ? (
        <div style={{ color: "#b91c1c", fontSize: 11 }} role="alert">
          {errors.map((issue) => issue.message).join(" ")}
        </div>
      ) : null}
    </div>
  );
};

export default DataCard;
