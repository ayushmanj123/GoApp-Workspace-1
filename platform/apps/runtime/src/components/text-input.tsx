import React from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
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

export const TextInput: React.FC<any> = ({
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
}) => {
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

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) return;
    const nextValue = event.target.value;
    setValue(nextValue);
    if (usesDefaultBinding && bindingField) {
      formEdit?.reportUpdate(bindingField, nextValue);
    }
    if (resolvedControlName) {
      controlValueStore.set(resolvedControlName, "Value", nextValue);
    }
    await runOnChange();
  };

  return (
    <input
      id={id}
      data-testid={resolvedControlName ? `input-${resolvedControlName}` : undefined}
      value={localValue}
      placeholder={resolvedPlaceholder}
      title={resolvedTooltip || undefined}
      disabled={Boolean(disabled || formEdit?.isReadOnly)}
      readOnly={Boolean(readOnly || formEdit?.isReadOnly)}
      aria-readonly={isLocked || undefined}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={handleChange}
      style={inputChrome}
    />
  );
};
export default TextInput;
