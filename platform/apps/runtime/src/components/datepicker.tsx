import React from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
import { useParentItemDefault } from "../hooks/use-parent-item-default";
import { useFormEditContext } from "../form-edit-context";
import { parseParentItemField } from "../utils/parent-item-field";
import { useControlValueStore } from "../formula/formula-context";
import { useRuntimeActionHandler } from "../hooks/use-runtime-action-handler";
import { chainFocus, useControlChrome } from "../hooks/use-control-chrome";
import { readPropertyText } from "../utils/appearance-style";
import {
  normalizeDateInputValue,
  useEditableControlValue,
} from "../hooks/use-editable-control-value";

function readPropertyFormula(property: unknown): string {
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    return typeof formula === "string" ? formula.trim() : "";
  }
  return "";
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseStartOfWeek(raw: unknown): number {
  const text = readPropertyText(raw).toLowerCase();
  if (!text) return 0;
  const names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const named = names.indexOf(text);
  if (named >= 0) return named;
  const n = Number(text);
  if (Number.isFinite(n)) return ((Math.trunc(n) % 7) + 7) % 7;
  return 0;
}

export function formatDateDisplay(iso: string, format: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match || !format.trim()) return iso;
  const year = match[1];
  const month = Number(match[2]);
  const day = match[3];
  return format
    .replace(/yyyy/g, year)
    .replace(/yy/g, year.slice(2))
    .replace(/MMMM/g, MONTHS[month - 1] ?? match[2])
    .replace(/MMM/g, MONTHS[month - 1] ?? match[2])
    .replace(/MM/g, match[2])
    .replace(/dd/g, day)
    .replace(/d(?!d)/g, String(Number(day)));
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

export const DatePicker: React.FC<any> = (props) => {
  const {
    value = "",
    default: defaultProperty,
    disabled = false,
    readOnly = false,
    onChange,
    tooltip,
    controlName,
    name,
    id,
    format,
    startOfWeek,
    minDate,
    maxDate,
  } = props;
  const formEdit = useFormEditContext();
  const controlValueStore = useControlValueStore();
  const defaultFormula = readPropertyFormula(defaultProperty);
  const bindingField = defaultFormula ? parseParentItemField(defaultFormula) : null;
  const usesDefaultBinding = Boolean(bindingField && defaultProperty);
  const resolvedDefault = useParentItemDefault(defaultProperty);
  const resolvedValue = useResolvedPropertyText(usesDefaultBinding ? undefined : value);
  const resolvedTooltip = useResolvedPropertyText(tooltip);
  const resolvedFormat = useResolvedPropertyText(format);
  const resolvedMin = useResolvedPropertyText(minDate);
  const resolvedMax = useResolvedPropertyText(maxDate);
  const weekStart = parseStartOfWeek(startOfWeek);
  const chrome = useControlChrome(props, { disabled: Boolean(disabled), includeText: true });
  const resolvedControlName = controlName ?? name;
  const runOnChange = useRuntimeActionHandler(onChange, resolvedControlName, "OnChange");
  const externalValue = normalizeDateInputValue(
    usesDefaultBinding ? resolvedDefault : resolvedValue,
  );
  const isLocked = Boolean(disabled || readOnly || formEdit?.isReadOnly);

  const { value: localValue, setValue, onFocus, onBlur } =
    useEditableControlValue(externalValue, {
      recordKey: formEdit?.recordKey ?? null,
    });
  const focus = chainFocus(chrome, onFocus, onBlur);
  const formatted = resolvedFormat ? formatDateDisplay(localValue, resolvedFormat) : "";
  const weekdays = [...WEEKDAYS.slice(weekStart), ...WEEKDAYS.slice(0, weekStart)];

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
    <div style={{ width: "100%", height: "100%", boxSizing: "border-box" }}>
      {readPropertyText(startOfWeek) ? (
        <div data-testid="datepicker-week-start" style={{ display: "flex", fontSize: 10, color: "#666" }}>
          {weekdays.map((day) => (
            <span key={day} style={{ flex: 1, textAlign: "center" }}>
              {day}
            </span>
          ))}
        </div>
      ) : null}
      <input
        id={id}
        type="date"
        min={resolvedMin || undefined}
        max={resolvedMax || undefined}
        data-start-of-week={weekStart}
        data-testid={resolvedControlName ? `datepicker-${resolvedControlName}` : undefined}
        value={localValue}
        title={resolvedTooltip || formatted || undefined}
        disabled={isLocked}
        readOnly={Boolean(readOnly || formEdit?.isReadOnly)}
        aria-readonly={isLocked || undefined}
        tabIndex={chrome.tabIndex}
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        onChange={handleChange}
        style={{ ...inputChrome, ...chrome.style }}
      />
      {formatted ? (
        <div data-testid="datepicker-format" style={{ fontSize: 11, color: "#444" }}>
          {formatted}
        </div>
      ) : null}
    </div>
  );
};
export default DatePicker;
