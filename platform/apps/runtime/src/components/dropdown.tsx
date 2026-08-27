import React, { useMemo } from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
import { useParentItemDefault } from "../hooks/use-parent-item-default";
import { useFormEditContext } from "../form-edit-context";
import { parseParentItemField } from "../utils/parent-item-field";
import { useControlValueStore } from "../formula/formula-context";
import { useResolvedGalleryRecords } from "../hooks/use-resolved-gallery-items";
import { firstStringLikeField } from "../utils/gallery-rows";
import { useRuntimeActionHandler } from "../hooks/use-runtime-action-handler";
import { useEditableControlValue } from "../hooks/use-editable-control-value";

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

const selectChrome: React.CSSProperties = {
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

export const Dropdown: React.FC<any> = ({
  items,
  default: defaultProperty,
  value,
  disabled = false,
  readOnly = false,
  onChange,
  controlName,
  name,
  id,
}) => {
  const formEdit = useFormEditContext();
  const controlValueStore = useControlValueStore();
  const records = useResolvedGalleryRecords(items);
  const options = useMemo(() => toDropdownOptions(records), [records]);
  const defaultFormula = readPropertyFormula(defaultProperty);
  const bindingField = defaultFormula ? parseParentItemField(defaultFormula) : null;
  const usesDefaultBinding = Boolean(bindingField && defaultProperty);
  const resolvedDefault = useParentItemDefault(defaultProperty);
  const resolvedValue = useResolvedPropertyText(usesDefaultBinding ? undefined : value);
  const resolvedControlName = controlName ?? name;
  const runOnChange = useRuntimeActionHandler(onChange, resolvedControlName, "OnChange");
  const externalValue = usesDefaultBinding ? resolvedDefault : resolvedValue;
  const isLocked = Boolean(disabled || readOnly || formEdit?.isReadOnly);

  const { value: localValue, setValue, onFocus, onBlur } =
    useEditableControlValue(externalValue, {
      recordKey: formEdit?.recordKey ?? null,
    });

  const handleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
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
    <select
      id={id}
      data-testid={resolvedControlName ? `dropdown-${resolvedControlName}` : undefined}
      value={localValue}
      disabled={isLocked}
      aria-readonly={isLocked || undefined}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={handleChange}
      style={selectChrome}
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
