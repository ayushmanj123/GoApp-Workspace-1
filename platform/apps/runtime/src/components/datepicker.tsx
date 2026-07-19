import React, { useEffect, useState } from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
import { useParentItemDefault } from "../hooks/use-parent-item-default";
import { useFormEditContext } from "../form-edit-context";
import { parseParentItemField } from "../utils/parent-item-field";
import { useControlValueStore } from "../formula/formula-context";
import { useRuntimeActionHandler } from "../hooks/use-runtime-action-handler";

function readPropertyFormula(property: unknown): string {
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    return typeof formula === "string" ? formula.trim() : "";
  }
  return "";
}

export const DatePicker: React.FC<any> = ({
  value = "",
  default: defaultProperty,
  disabled = false,
  onChange,
  controlName,
  name,
}) => {
  const formEdit = useFormEditContext();
  const controlValueStore = useControlValueStore();
  const defaultFormula = readPropertyFormula(defaultProperty);
  const bindingField = defaultFormula ? parseParentItemField(defaultFormula) : null;
  const usesDefaultBinding = Boolean(formEdit && bindingField && defaultProperty);
  const resolvedDefault = useParentItemDefault(defaultProperty);
  const resolvedValue = useResolvedPropertyText(usesDefaultBinding ? undefined : value);
  const resolvedControlName = controlName ?? name;
  const runOnChange = useRuntimeActionHandler(onChange, resolvedControlName, "OnChange");

  const [localValue, setLocalValue] = useState(resolvedDefault);

  useEffect(() => {
    if (usesDefaultBinding) {
      setLocalValue(resolvedDefault);
    }
  }, [usesDefaultBinding, resolvedDefault]);

  const displayValue = usesDefaultBinding ? localValue : resolvedValue;

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    if (usesDefaultBinding && bindingField) {
      setLocalValue(nextValue);
      formEdit?.reportUpdate(bindingField, nextValue);
    }
    if (resolvedControlName) {
      controlValueStore.set(resolvedControlName, "Value", nextValue);
    }
    await runOnChange();
  };

  return (
    <input
      type="date"
      data-testid={resolvedControlName ? `datepicker-${resolvedControlName}` : undefined}
      value={displayValue}
      disabled={disabled}
      onChange={handleChange}
      style={{ width: "100%", height: "100%", boxSizing: "border-box" }}
    />
  );
};
export default DatePicker;
