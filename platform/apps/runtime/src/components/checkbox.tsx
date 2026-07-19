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

function readBooleanProperty(property: unknown, fallback = false): boolean {
  if (typeof property === "boolean") {
    return property;
  }
  if (property && typeof property === "object" && "value" in property) {
    return Boolean((property as { value?: unknown }).value);
  }
  return fallback;
}

export const Checkbox: React.FC<any> = ({
  text = "Checkbox",
  checked = false,
  default: defaultProperty,
  disabled = false,
  onChange,
  controlName,
  name,
}) => {
  const label = useResolvedPropertyText(text, "Checkbox");
  const formEdit = useFormEditContext();
  const controlValueStore = useControlValueStore();
  const defaultFormula = readPropertyFormula(defaultProperty);
  const bindingField = defaultFormula ? parseParentItemField(defaultFormula) : null;
  const usesDefaultBinding = Boolean(formEdit && bindingField && defaultProperty);
  const resolvedDefault = useParentItemDefault(defaultProperty);
  const staticChecked = readBooleanProperty(checked, false);
  const resolvedControlName = controlName ?? name;
  const runOnChange = useRuntimeActionHandler(onChange, resolvedControlName, "OnChange");

  const [localChecked, setLocalChecked] = useState(
    usesDefaultBinding ? resolvedDefault === "true" : staticChecked,
  );

  useEffect(() => {
    if (usesDefaultBinding) {
      setLocalChecked(resolvedDefault === "true");
    }
  }, [usesDefaultBinding, resolvedDefault]);

  const isChecked = usesDefaultBinding ? localChecked : staticChecked;

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.checked;
    if (usesDefaultBinding && bindingField) {
      setLocalChecked(nextValue);
      formEdit?.reportUpdate(bindingField, nextValue);
    }
    if (resolvedControlName) {
      controlValueStore.set(resolvedControlName, "Checked", nextValue);
    }
    await runOnChange();
  };

  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <input
        type="checkbox"
        checked={isChecked}
        disabled={disabled}
        onChange={handleChange}
      />
      {label}
    </label>
  );
};
export default Checkbox;
