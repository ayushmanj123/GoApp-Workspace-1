import React, { useCallback, useEffect, useRef, useState } from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
import { useParentItemDefault } from "../hooks/use-parent-item-default";
import { useFormEditContext } from "../form-edit-context";
import { parseParentItemField } from "../utils/parent-item-field";
import { useControlValueStore } from "../formula/formula-context";
import { useRuntimeActionHandler } from "../hooks/use-runtime-action-handler";
import { parseLooseBoolean } from "../hooks/use-editable-control-value";

function readPropertyFormula(property: unknown): string {
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    return typeof formula === "string" ? formula.trim() : "";
  }
  return "";
}

function readBooleanProperty(property: unknown, fallback = false): boolean {
  if (typeof property === "boolean") {
    return property;
  }
  if (property && typeof property === "object" && "value" in property) {
    return parseLooseBoolean((property as { value?: unknown }).value);
  }
  return fallback;
}

export const Toggle: React.FC<any> = ({
  text = "Toggle",
  checked = false,
  default: defaultProperty,
  disabled = false,
  readOnly = false,
  onChange,
  controlName,
  name,
  id,
}) => {
  const label = useResolvedPropertyText(text, "Toggle");
  const formEdit = useFormEditContext();
  const controlValueStore = useControlValueStore();
  const defaultFormula = readPropertyFormula(defaultProperty);
  const bindingField = defaultFormula ? parseParentItemField(defaultFormula) : null;
  const usesDefaultBinding = Boolean(bindingField && defaultProperty);
  const resolvedDefault = useParentItemDefault(defaultProperty);
  const staticChecked = readBooleanProperty(checked, false);
  const resolvedControlName = controlName ?? name;
  const runOnChange = useRuntimeActionHandler(onChange, resolvedControlName, "OnChange");
  const externalChecked = usesDefaultBinding
    ? parseLooseBoolean(resolvedDefault)
    : staticChecked;
  const isLocked = Boolean(disabled || readOnly || formEdit?.isReadOnly);

  const [localChecked, setLocalChecked] = useState(externalChecked);
  const focusedRef = useRef(false);
  const prevRecordKey = useRef(formEdit?.recordKey ?? null);

  useEffect(() => {
    const recordKey = formEdit?.recordKey ?? null;
    const recordChanged = prevRecordKey.current !== recordKey;
    prevRecordKey.current = recordKey;
    if (focusedRef.current && !recordChanged) return;
    setLocalChecked(externalChecked);
  }, [externalChecked, formEdit?.recordKey]);

  const handleChange = async () => {
    if (isLocked) return;
    const nextValue = !localChecked;
    setLocalChecked(nextValue);
    if (usesDefaultBinding && bindingField) {
      formEdit?.reportUpdate(bindingField, nextValue);
    }
    if (resolvedControlName) {
      controlValueStore.set(resolvedControlName, "Checked", nextValue);
    }
    await runOnChange();
  };

  const onFocus = useCallback(() => {
    focusedRef.current = true;
  }, []);
  const onBlur = useCallback(() => {
    focusedRef.current = false;
  }, []);

  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        minHeight: 32,
        boxSizing: "border-box",
        cursor: isLocked ? "not-allowed" : "pointer",
        opacity: isLocked ? 0.7 : 1,
      }}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={localChecked}
        disabled={isLocked}
        onFocus={onFocus}
        onBlur={onBlur}
        onClick={handleChange}
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          border: "none",
          background: localChecked ? "#4A90D9" : "#ccc",
          position: "relative",
          padding: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: localChecked ? 20 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.15s",
          }}
        />
      </button>
      {label}
    </label>
  );
};
export default Toggle;
