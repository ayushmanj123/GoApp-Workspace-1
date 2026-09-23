import React, { useCallback } from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
import { useRuntimeActionHandler } from "../hooks/use-runtime-action-handler";
import { useControlChrome } from "../hooks/use-control-chrome";
import { readPropertyText } from "../utils/appearance-style";

function hasActionFormula(property: unknown): boolean {
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    return typeof formula === "string" && formula.trim().length > 0;
  }
  return false;
}

function objectFitFor(position: unknown): React.CSSProperties["objectFit"] {
  const text = readPropertyText(position).toLowerCase();
  if (text === "fill" || text === "stretch") return "fill";
  if (text === "center") return "none";
  if (text === "cover") return "cover";
  return "contain";
}

export const Image: React.FC<any> = (props) => {
  const {
    src,
    alt = "",
    onSelect,
    controlName,
    name,
    disabled = false,
    readOnly = false,
    tooltip,
    imagePosition,
  } = props;
  const resolvedSrc = useResolvedPropertyText(src, "");
  const resolvedAlt = useResolvedPropertyText(alt, "Image");
  const resolvedTooltip = useResolvedPropertyText(tooltip);
  const chrome = useControlChrome(props, { disabled: Boolean(disabled), includeText: false });
  const fit = objectFitFor(imagePosition);
  const resolvedControlName = controlName ?? name;
  const runOnSelect = useRuntimeActionHandler(
    onSelect,
    resolvedControlName,
    "OnSelect",
  );
  const clickable = hasActionFormula(onSelect) && !disabled && !readOnly;

  const onActivate = useCallback(() => {
    if (!clickable) return;
    void runOnSelect();
  }, [clickable, runOnSelect]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!clickable) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    },
    [clickable, onActivate],
  );

  const interactiveProps = clickable
    ? {
        role: "button" as const,
        tabIndex: chrome.tabIndex ?? 0,
        onClick: onActivate,
        onKeyDown,
      }
    : { tabIndex: chrome.tabIndex };

  if (!resolvedSrc) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#f0f0f0",
          border: "1px dashed #bbb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          color: "#666",
          boxSizing: "border-box",
          cursor: clickable ? "pointer" : undefined,
          ...chrome.style,
        }}
        title={resolvedTooltip || undefined}
        {...interactiveProps}
      >
        Image
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={resolvedAlt}
      style={{
        width: "100%",
        height: "100%",
        objectFit: fit,
        objectPosition: fit === "none" ? "center" : undefined,
        boxSizing: "border-box",
        cursor: clickable ? "pointer" : undefined,
        ...chrome.style,
      }}
      title={resolvedTooltip || undefined}
      {...interactiveProps}
    />
  );
};
export default Image;
