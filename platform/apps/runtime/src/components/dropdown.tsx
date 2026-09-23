import React, { useMemo, useState } from "react";
import { chainFocus, useControlChrome } from "../hooks/use-control-chrome";
import { readBooleanProperty } from "../utils/appearance-style";
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

function fieldString(
  record: Record<string, unknown>,
  fieldName: string,
): string | null {
  const trimmed = fieldName.trim();
  if (!trimmed) return null;
  const raw = record[trimmed];
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return null;
}

function toDropdownOptions(
  records: Record<string, unknown>[],
  displayField = "",
  valueField = "",
): Array<{ value: string; label: string }> {
  return records.map((record, index) => {
    const mappedValue = fieldString(record, valueField);
    const value =
      mappedValue ||
      (typeof record.Value === "string" && record.Value) ||
      (typeof record.value === "string" && record.value) ||
      firstStringLikeField(record) ||
      String(index);
    const mappedLabel = fieldString(record, displayField);
    const label =
      mappedLabel ||
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

export const Dropdown: React.FC<any> = (props) => {
  const {
    items,
    default: defaultProperty,
    value,
    displayField,
    valueField,
    disabled = false,
    readOnly = false,
    onChange,
    tooltip,
    controlName,
    name,
    id,
    allowEmptySelection,
    isSearchable,
  } = props;
  const formEdit = useFormEditContext();
  const controlValueStore = useControlValueStore();
  const records = useResolvedGalleryRecords(items);
  const resolvedDisplayField = useResolvedPropertyText(displayField);
  const resolvedValueField = useResolvedPropertyText(valueField);
  const options = useMemo(
    () => toDropdownOptions(records, resolvedDisplayField, resolvedValueField),
    [records, resolvedDisplayField, resolvedValueField],
  );
  const allowEmpty = readBooleanProperty(allowEmptySelection, false);
  const searchable = readBooleanProperty(isSearchable, false);
  const [query, setQuery] = useState("");
  const visibleOptions = useMemo(() => {
    const base = allowEmpty ? [{ value: "", label: "" }, ...options] : options;
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return base;
    return base.filter(
      (option) =>
        option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q),
    );
  }, [allowEmpty, options, query, searchable]);
  const chrome = useControlChrome(props, { disabled: Boolean(disabled), includeText: true });
  const defaultFormula = readPropertyFormula(defaultProperty);
  const bindingField = defaultFormula ? parseParentItemField(defaultFormula) : null;
  const usesDefaultBinding = Boolean(bindingField && defaultProperty);
  const resolvedDefault = useParentItemDefault(defaultProperty);
  const resolvedValue = useResolvedPropertyText(usesDefaultBinding ? undefined : value);
  const resolvedTooltip = useResolvedPropertyText(tooltip);
  const resolvedControlName = controlName ?? name;
  const runOnChange = useRuntimeActionHandler(onChange, resolvedControlName, "OnChange");
  const externalValue = usesDefaultBinding ? resolvedDefault : resolvedValue;
  const isLocked = Boolean(disabled || readOnly || formEdit?.isReadOnly);

  const { value: localValue, setValue, onFocus, onBlur } =
    useEditableControlValue(externalValue, {
      recordKey: formEdit?.recordKey ?? null,
    });
  const focus = chainFocus(chrome, onFocus, onBlur);

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

  const select = (
    <select
      id={id}
      data-testid={resolvedControlName ? `dropdown-${resolvedControlName}` : undefined}
      value={localValue}
      title={resolvedTooltip || undefined}
      disabled={isLocked}
      aria-readonly={isLocked || undefined}
      tabIndex={chrome.tabIndex}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      onMouseEnter={chrome.handlers.onMouseEnter}
      onMouseLeave={chrome.handlers.onMouseLeave}
      onChange={handleChange}
      style={{ ...selectChrome, ...chrome.style }}
    >
      {visibleOptions.map((opt) => (
        <option key={`${opt.value}:${opt.label}`} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );

  if (!searchable) return select;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", gap: 4 }}>
      <input
        aria-label="Search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search"
        style={{ ...selectChrome, height: 28, minHeight: 28 }}
      />
      {select}
    </div>
  );
};
export default Dropdown;
