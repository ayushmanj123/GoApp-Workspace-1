import React, { useEffect, useRef, useState } from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
import { useParentItemDefault } from "../hooks/use-parent-item-default";
import { useFormEditContext } from "../form-edit-context";
import { parseParentItemField } from "../utils/parent-item-field";
import { useControlValueStore } from "../formula/formula-context";
import { useRuntimeActionHandler } from "../hooks/use-runtime-action-handler";
import { useControlChrome } from "../hooks/use-control-chrome";
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

export const Checkbox: React.FC<any> = (props) => {
  const {
    text = "Checkbox",
    checked = false,
    default: defaultProperty,
    disabled = false,
    readOnly = false,
    onChange,
    onCheck,
    onUncheck,
    tooltip,
    controlName,
    name,
    id,
  } = props;
  const label = useResolvedPropertyText(text, "Checkbox");
  const resolvedTooltip = useResolvedPropertyText(tooltip);
  const formEdit = useFormEditContext();
  const controlValueStore = useControlValueStore();
  const defaultFormula = readPropertyFormula(defaultProperty);
  const bindingField = defaultFormula ? parseParentItemField(defaultFormula) : null;
  const usesDefaultBinding = Boolean(bindingField && defaultProperty);
  const resolvedDefault = useParentItemDefault(defaultProperty);
  const staticChecked = readBooleanProperty(checked, false);
  const resolvedControlName = controlName ?? name;
  const runOnChange = useRuntimeActionHandler(onChange, resolvedControlName, "OnChange");
  const runOnCheck = useRuntimeActionHandler(onCheck, resolvedControlName, "OnCheck");
  const runOnUncheck = useRuntimeActionHandler(onUncheck, resolvedControlName, "OnUncheck");
  const chrome = useControlChrome(props, { disabled: Boolean(disabled), includeText: true });
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

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) return;
    const nextValue = event.target.checked;
    setLocalChecked(nextValue);
    if (usesDefaultBinding && bindingField) {
      formEdit?.reportUpdate(bindingField, nextValue);
    }
    if (resolvedControlName) {
      controlValueStore.set(resolvedControlName, "Checked", nextValue);
    }
    await runOnChange();
    if (nextValue) await runOnCheck();
    else await runOnUncheck();
  };

  return (
    <label
      htmlFor={id}
      title={resolvedTooltip || undefined}
      tabIndex={chrome.tabIndex}
      onMouseEnter={chrome.handlers.onMouseEnter}
      onMouseLeave={chrome.handlers.onMouseLeave}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        minHeight: 32,
        boxSizing: "border-box",
        opacity: isLocked ? 0.7 : 1,
        ...chrome.style,
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={localChecked}
        disabled={isLocked}
        onFocus={() => {
          focusedRef.current = true;
          chrome.handlers.onFocus();
        }}
        onBlur={() => {
          focusedRef.current = false;
          chrome.handlers.onBlur();
        }}
        onChange={handleChange}
      />
      {label}
    </label>
  );
};
export default Checkbox;
