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

export const Toggle: React.FC<any> = ({
  text = "Toggle",
  checked = false,
  default: defaultProperty,
  disabled = false,
  onChange,
  controlName,
  name,
}) => {
  const label = useResolvedPropertyText(text, "Toggle");
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

  const handleChange = async () => {
    const nextValue = !isChecked;
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
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        disabled={disabled}
        onClick={handleChange}
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          border: "none",
          background: isChecked ? "#4A90D9" : "#ccc",
          position: "relative",
          padding: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: isChecked ? 20 : 2,
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
