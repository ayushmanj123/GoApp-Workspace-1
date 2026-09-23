import React, { useRef } from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
import { chainFocus, useControlChrome } from "../hooks/use-control-chrome";
import { readBooleanProperty, readOptionalNumber } from "../utils/appearance-style";
import { useParentItemDefault } from "../hooks/use-parent-item-default";
import { useFormEditContext } from "../form-edit-context";
import { parseParentItemField } from "../utils/parent-item-field";
import { useControlValueStore } from "../formula/formula-context";
import { useEditableControlValue } from "../hooks/use-editable-control-value";
import { useRuntimeActionHandler } from "../hooks/use-runtime-action-handler";

function readPropertyFormula(property: unknown): string {
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    return typeof formula === "string" ? formula.trim() : "";
  }
  return "";
}

const inputChrome: React.CSSProperties = {
  width: "100%",
  height: "100%",
  minHeight: 32,
  boxSizing: "border-box",
  border: "1px solid #c8c8c8",
  borderRadius: 4,
  padding: "4px 8px",
  font: "inherit",
  background: "#fff",
};

export const TextInput: React.FC<any> = (props) => {
  const {
    value = "",
    default: defaultProperty,
    placeholder = "",
    disabled = false,
    readOnly = false,
    controlName,
    name,
    id,
    onChange,
    tooltip,
    inputMode,
    mode,
    maxLength,
    clear,
    delayOutput,
  } = props;
  const formEdit = useFormEditContext();
  const controlValueStore = useControlValueStore();
  const defaultFormula = readPropertyFormula(defaultProperty);
  const bindingField = defaultFormula
    ? parseParentItemField(defaultFormula)
    : null;
  const usesDefaultBinding = Boolean(bindingField && defaultProperty);

  const resolvedDefault = useParentItemDefault(defaultProperty);
  const resolvedValue = useResolvedPropertyText(
    usesDefaultBinding ? undefined : value,
  );
  const resolvedPlaceholder = useResolvedPropertyText(placeholder);
  const resolvedTooltip = useResolvedPropertyText(tooltip);
  const resolvedMode = useResolvedPropertyText(mode, "SingleLine").toLowerCase();
  const resolvedInputMode = useResolvedPropertyText(inputMode);
  const maxLen = readOptionalNumber(maxLength);
  const showClear = readBooleanProperty(clear, false);
  const delay = readBooleanProperty(delayOutput, false);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chrome = useControlChrome(props, { disabled: Boolean(disabled), includeText: true });
  const resolvedControlName = controlName ?? name;
  const runOnChange = useRuntimeActionHandler(
    onChange,
    resolvedControlName,
    "OnChange",
  );
  const externalValue = usesDefaultBinding ? resolvedDefault : resolvedValue;
  const isLocked = Boolean(disabled || readOnly || formEdit?.isReadOnly);

  const { value: localValue, setValue, onFocus, onBlur } =
    useEditableControlValue(externalValue, {
      recordKey: formEdit?.recordKey ?? null,
    });
  const focus = chainFocus(chrome, onFocus, onBlur);

  const commit = async (nextValue: string) => {
    if (usesDefaultBinding && bindingField) {
      formEdit?.reportUpdate(bindingField, nextValue);
    }
    if (resolvedControlName) {
      controlValueStore.set(resolvedControlName, "Value", nextValue);
    }
    await runOnChange();
  };

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (isLocked) return;
    const nextValue = event.target.value;
    setValue(nextValue);
    if (delay) {
      if (delayRef.current) clearTimeout(delayRef.current);
      delayRef.current = setTimeout(() => {
        void commit(nextValue);
      }, 500);
      return;
    }
    await commit(nextValue);
  };

  const isMulti = resolvedMode.includes("multi");
  const fieldStyle = { ...inputChrome, ...chrome.style };
  const shared = {
    id,
    "data-testid": resolvedControlName ? `input-${resolvedControlName}` : undefined,
    value: localValue,
    placeholder: resolvedPlaceholder,
    title: resolvedTooltip || undefined,
    disabled: Boolean(disabled || formEdit?.isReadOnly),
    readOnly: Boolean(readOnly || formEdit?.isReadOnly),
    "aria-readonly": isLocked || undefined,
    maxLength: maxLen && maxLen > 0 ? maxLen : undefined,
    tabIndex: chrome.tabIndex,
    onFocus: focus.onFocus,
    onBlur: focus.onBlur,
    onChange: handleChange,
    onMouseEnter: chrome.handlers.onMouseEnter,
    onMouseLeave: chrome.handlers.onMouseLeave,
    onMouseDown: chrome.handlers.onMouseDown,
    onMouseUp: chrome.handlers.onMouseUp,
    style: fieldStyle,
  };

  const field = isMulti ? (
    <textarea {...shared} />
  ) : (
    <input
      {...shared}
      type={resolvedMode.includes("password") ? "password" : "text"}
      inputMode={(resolvedInputMode || undefined) as React.HTMLAttributes<HTMLInputElement>["inputMode"]}
    />
  );

  if (!showClear) return field;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {field}
      <button
        type="button"
        aria-label="Clear"
        onClick={() => {
          if (isLocked) return;
          setValue("");
          void commit("");
        }}
        style={{
          position: "absolute",
          right: 4,
          top: "50%",
          transform: "translateY(-50%)",
          border: "none",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  );
};
export default TextInput;
