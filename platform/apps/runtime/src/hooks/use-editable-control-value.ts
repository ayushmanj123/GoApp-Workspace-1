import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Editable control value that always keeps a local draft.
 * Syncs from the external source only when not focused (or when recordKey changes).
 */
export function useEditableControlValue(
  externalValue: string,
  options?: { recordKey?: string | null },
): {
  value: string;
  setValue: (next: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  isFocused: boolean;
} {
  const [value, setValue] = useState(externalValue ?? "");
  const focusedRef = useRef(false);
  const [isFocused, setIsFocused] = useState(false);
  const recordKey = options?.recordKey ?? null;
  const prevRecordKey = useRef(recordKey);

  useEffect(() => {
    const recordChanged = prevRecordKey.current !== recordKey;
    prevRecordKey.current = recordKey;
    if (focusedRef.current && !recordChanged) {
      return;
    }
    setValue(externalValue ?? "");
  }, [externalValue, recordKey]);

  const onFocus = useCallback(() => {
    focusedRef.current = true;
    setIsFocused(true);
  }, []);

  const onBlur = useCallback(() => {
    focusedRef.current = false;
    setIsFocused(false);
  }, []);

  return { value, setValue, onFocus, onBlur, isFocused };
}

export function parseLooseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return (
      normalized === "true" ||
      normalized === "1" ||
      normalized === "yes" ||
      normalized === "on"
    );
  }
  return Boolean(value);
}

/** Normalize to yyyy-MM-dd for input[type=date]. */
export function normalizeDateInputValue(value: unknown): string {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
