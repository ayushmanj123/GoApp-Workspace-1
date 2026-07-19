import React, { useEffect, useMemo, useState } from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
import { useParentItemDefault } from "../hooks/use-parent-item-default";
import { useFormEditContext } from "../form-edit-context";
import { parseParentItemField } from "../utils/parent-item-field";
import { useControlValueStore } from "../formula/formula-context";
import { useResolvedGalleryRecords } from "../hooks/use-resolved-gallery-items";
import { firstStringLikeField } from "../utils/gallery-rows";
import { useRuntimeActionHandler } from "../hooks/use-runtime-action-handler";

function readPropertyFormula(property: unknown): string {
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    return typeof formula === "string" ? formula.trim() : "";
  }
  return "";
}

function toDropdownOptions(
  records: Record<string, unknown>[],
): Array<{ value: string; label: string }> {
  return records.map((record, index) => {
    const value =
      (typeof record.Value === "string" && record.Value) ||
      (typeof record.value === "string" && record.value) ||
      firstStringLikeField(record) ||
      String(index);
    const label =
      (typeof record.Label === "string" && record.Label) ||
      (typeof record.label === "string" && record.label) ||
      firstStringLikeField(record) ||
      value;
    return { value, label };
  });
}

export const Dropdown: React.FC<any> = ({
  items,
  default: defaultProperty,
  value,
  disabled = false,
  onChange,
  controlName,
  name,
}) => {
  const formEdit = useFormEditContext();
  const controlValueStore = useControlValueStore();
  const records = useResolvedGalleryRecords(items);
  const options = useMemo(() => toDropdownOptions(records), [records]);
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

  const handleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
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
    <select
      data-testid={resolvedControlName ? `dropdown-${resolvedControlName}` : undefined}
      value={displayValue}
      disabled={disabled}
      onChange={handleChange}
      style={{ width: "100%", height: "100%", boxSizing: "border-box" }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};
export default Dropdown;
