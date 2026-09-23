import React, { useMemo, useState } from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
import { useParentItemDefault } from "../hooks/use-parent-item-default";
import { useRuntimeActionHandler } from "../hooks/use-runtime-action-handler";
import { useControlChrome } from "../hooks/use-control-chrome";
import { useResolvedGalleryRecords } from "../hooks/use-resolved-gallery-items";
import { firstStringLikeField } from "../utils/gallery-rows";
import { readBooleanProperty, readOptionalNumber, readPropertyText } from "../utils/appearance-style";
import { useControlValueStore } from "../formula/formula-context";

function readPropertyFormula(property: unknown): string {
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    return typeof formula === "string" ? formula.trim() : "";
  }
  return "";
}

function optionLabel(record: Record<string, unknown>): string {
  return firstStringLikeField(record);
}

export const Radio: React.FC<any> = (props) => {
  const {
    items,
    default: defaultProperty,
    value,
    layout,
    disabled = false,
    readOnly = false,
    onChange,
    tooltip,
    controlName,
    name,
  } = props;
  const records = useResolvedGalleryRecords(items);
  const options = useMemo(
    () => records.map((record) => optionLabel(record)).filter(Boolean),
    [records],
  );
  const resolvedDefault = useParentItemDefault(defaultProperty);
  const resolvedValue = useResolvedPropertyText(
    readPropertyFormula(defaultProperty) ? undefined : value,
  );
  const external = readPropertyFormula(defaultProperty) ? resolvedDefault : resolvedValue;
  const [local, setLocal] = useState(external);
  const resolvedTooltip = useResolvedPropertyText(tooltip);
  const resolvedName = controlName ?? name ?? "radio";
  const runOnChange = useRuntimeActionHandler(onChange, resolvedName, "OnChange");
  const store = useControlValueStore();
  const chrome = useControlChrome(props, { disabled: Boolean(disabled || readOnly), includeText: true });
  const direction = readPropertyText(layout).toLowerCase() === "horizontal" ? "row" : "column";

  return (
    <div
      title={resolvedTooltip || undefined}
      style={{
        display: "flex",
        flexDirection: direction,
        gap: 6,
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        ...chrome.style,
      }}
      {...chrome.handlers}
    >
      {options.map((option) => (
        <label key={option} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="radio"
            name={resolvedName}
            value={option}
            checked={local === option}
            disabled={Boolean(disabled || readOnly)}
            tabIndex={chrome.tabIndex}
            onChange={async () => {
              if (disabled || readOnly) return;
              setLocal(option);
              store.set(resolvedName, "Value", option);
              await runOnChange();
            }}
          />
          {option}
        </label>
      ))}
    </div>
  );
};

export const Slider: React.FC<any> = (props) => {
  const {
    min,
    max,
    value,
    default: defaultProperty,
    showValue,
    disabled = false,
    readOnly = false,
    onChange,
    tooltip,
    controlName,
    name,
  } = props;
  const resolvedDefault = useParentItemDefault(defaultProperty);
  const resolvedValue = useResolvedPropertyText(
    readPropertyFormula(defaultProperty) ? undefined : value,
  );
  const external = readPropertyFormula(defaultProperty) ? resolvedDefault : resolvedValue;
  const [local, setLocal] = useState(external || "0");
  const resolvedTooltip = useResolvedPropertyText(tooltip);
  const resolvedName = controlName ?? name;
  const runOnChange = useRuntimeActionHandler(onChange, resolvedName, "OnChange");
  const store = useControlValueStore();
  const chrome = useControlChrome(props, { disabled: Boolean(disabled || readOnly), includeText: false });
  const minN = readOptionalNumber(min) ?? 0;
  const maxN = readOptionalNumber(max) ?? 100;
  const show = readBooleanProperty(showValue, true);

  return (
    <label
      title={resolvedTooltip || undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        ...chrome.style,
      }}
    >
      <input
        type="range"
        min={minN}
        max={maxN}
        value={Number(local) || 0}
        disabled={Boolean(disabled || readOnly)}
        tabIndex={chrome.tabIndex}
        onChange={async (event) => {
          if (disabled || readOnly) return;
          const next = event.target.value;
          setLocal(next);
          if (resolvedName) store.set(resolvedName, "Value", next);
          await runOnChange();
        }}
        style={{ flex: 1 }}
        {...chrome.handlers}
      />
      {show ? <span>{local}</span> : null}
    </label>
  );
};

function inAppHref(raw: string): string {
  const href = raw.trim();
  if (!href || href.startsWith("//")) return "";
  if (/^https?:/i.test(href)) return "";
  return href;
}

export const Link: React.FC<any> = (props) => {
  const { text = "Link", href, onSelect, tooltip, controlName, name, disabled = false } = props;
  const label = useResolvedPropertyText(text, "Link");
  const resolvedHref = inAppHref(useResolvedPropertyText(href));
  const resolvedTooltip = useResolvedPropertyText(tooltip);
  const runOnSelect = useRuntimeActionHandler(onSelect, controlName ?? name, "OnSelect");
  const chrome = useControlChrome(props, { disabled: Boolean(disabled), includeText: true });

  return (
    <a
      href={resolvedHref || undefined}
      title={resolvedTooltip || undefined}
      tabIndex={chrome.tabIndex}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        if (!resolvedHref) event.preventDefault();
        void runOnSelect();
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        color: "#1a56db",
        textDecoration: "underline",
        cursor: disabled ? "not-allowed" : "pointer",
        ...chrome.style,
      }}
      {...chrome.handlers}
    >
      {label}
    </a>
  );
};

export const Badge: React.FC<any> = (props) => {
  const label = useResolvedPropertyText(props.text, "Badge");
  const chrome = useControlChrome(props, { includeText: true });
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        background: "#e8f0fe",
        color: "#1a56db",
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 600,
        ...chrome.style,
      }}
    >
      {label}
    </span>
  );
};

export const Progress: React.FC<any> = (props) => {
  const value = readOptionalNumber(props.value) ?? 0;
  const max = readOptionalNumber(props.max) ?? 100;
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const chrome = useControlChrome(props, { includeText: false });
  const fill = typeof chrome.style.background === "string" ? chrome.style.background : "#4A90D9";
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        background: "#e6e6e6",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div style={{ height: "100%", background: fill, ...chrome.style, width: `${pct}%` }} />
    </div>
  );
};

export const Spinner: React.FC<any> = (props) => {
  const color = useResolvedPropertyText(props.color, "#4A90D9") || "#4A90D9";
  return (
    <div
      role="status"
      aria-label="Loading"
      data-testid="spinner-control"
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        borderRadius: "50%",
        border: `3px solid ${color}`,
        borderTopColor: "transparent",
        animation: "goapps-spin 0.8s linear infinite",
      }}
    >
      <style>{`@keyframes goapps-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export const Rating: React.FC<any> = (props) => {
  const {
    max,
    value,
    default: defaultProperty,
    disabled = false,
    readOnly = false,
    onChange,
    tooltip,
    controlName,
    name,
  } = props;
  const resolvedDefault = useParentItemDefault(defaultProperty);
  const resolvedValue = useResolvedPropertyText(
    readPropertyFormula(defaultProperty) ? undefined : value,
  );
  const external = readPropertyFormula(defaultProperty) ? resolvedDefault : resolvedValue;
  const [local, setLocal] = useState(Number(external) || 0);
  const resolvedTooltip = useResolvedPropertyText(tooltip);
  const resolvedName = controlName ?? name;
  const runOnChange = useRuntimeActionHandler(onChange, resolvedName, "OnChange");
  const store = useControlValueStore();
  const chrome = useControlChrome(props, { disabled: Boolean(disabled || readOnly), includeText: false });
  const count = readOptionalNumber(max) ?? 5;
  const locked = Boolean(disabled || readOnly);

  return (
    <div
      title={resolvedTooltip || undefined}
      style={{ display: "flex", alignItems: "center", gap: 2, width: "100%", height: "100%", ...chrome.style }}
    >
      {Array.from({ length: Math.max(1, count) }, (_, index) => {
        const score = index + 1;
        return (
          <button
            key={score}
            type="button"
            disabled={locked}
            tabIndex={chrome.tabIndex}
            aria-label={`${score}`}
            onClick={async () => {
              if (locked) return;
              setLocal(score);
              if (resolvedName) store.set(resolvedName, "Value", score);
              await runOnChange();
            }}
            style={{
              border: "none",
              background: "transparent",
              cursor: locked ? "not-allowed" : "pointer",
              fontSize: 18,
              color: score <= local ? "#f5b301" : "#ccc",
            }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
};
