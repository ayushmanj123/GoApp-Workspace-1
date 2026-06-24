import React, { useEffect, useState } from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
import { useParentItemDefault } from "../hooks/use-parent-item-default";
import { useFormEditContext } from "../form-edit-context";
import { parseParentItemField } from "../utils/parent-item-field";
import { useControlValueStore } from "../formula/formula-context";

function readPropertyFormula(property: unknown): string {
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    return typeof formula === "string" ? formula.trim() : "";
  }
  return "";
}

export const TextInput: React.FC<any> = ({
  value = "",
  default: defaultProperty,
  placeholder = "",
  controlName,
  onChange,
}) => {
  const formEdit = useFormEditContext();
  const controlValueStore = useControlValueStore();
  const defaultFormula = readPropertyFormula(defaultProperty);
  const bindingField = defaultFormula ? parseParentItemField(defaultFormula) : null;
  const usesDefaultBinding = Boolean(formEdit && bindingField && defaultProperty);

  const resolvedDefault = useParentItemDefault(defaultProperty);
  const resolvedValue = useResolvedPropertyText(usesDefaultBinding ? undefined : value);
  const resolvedPlaceholder = useResolvedPropertyText(placeholder);

  const [localValue, setLocalValue] = useState(resolvedDefault);

  useEffect(() => {
    if (usesDefaultBinding) {
      setLocalValue(resolvedDefault);
    }
  }, [usesDefaultBinding, resolvedDefault]);

  const displayValue = usesDefaultBinding ? localValue : resolvedValue;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    if (usesDefaultBinding && bindingField) {
      setLocalValue(nextValue);
      formEdit?.reportUpdate(bindingField, nextValue);
    }
    if (controlName) {
      controlValueStore.set(controlName, "Value", nextValue);
    }
    onChange?.(nextValue);
  };

  return (
    <input
      data-testid={controlName ? `input-${controlName}` : undefined}
      value={displayValue}
      placeholder={resolvedPlaceholder}
      onChange={handleChange}
    />
  );
};
export default TextInput;
