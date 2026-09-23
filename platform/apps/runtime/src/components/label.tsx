import React from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
import { useControlChrome } from "../hooks/use-control-chrome";
import { readBooleanProperty, readOptionalNumber, readPropertyText } from "../utils/appearance-style";

function unwrapScalar(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    return String(raw);
  }
  if (typeof raw === "object") {
    const obj = raw as { value?: unknown; formula?: unknown };
    if (obj.value != null) return String(obj.value);
    if (obj.formula != null) return String(obj.formula);
  }
  return "";
}

function resolveFontSize(raw: unknown): number {
  const text = unwrapScalar(raw).trim();
  if (!text) return 12;
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : 12;
}

function resolveFontWeight(raw: unknown): React.CSSProperties["fontWeight"] {
  const text = unwrapScalar(raw).trim();
  if (!text) return 600;
  const lower = text.toLowerCase();
  if (lower === "bold") return 700;
  if (lower === "normal" || lower === "regular") return 400;
  if (lower === "light") return 300;
  if (lower === "semibold" || lower === "semi-bold") return 600;
  const n = Number(text);
  if (Number.isFinite(n) && n >= 100 && n <= 900) return n;
  return text as React.CSSProperties["fontWeight"];
}

function resolveTextAlign(raw: unknown): React.CSSProperties["textAlign"] {
  const text = unwrapScalar(raw).trim().toLowerCase();
  if (text === "center" || text === "right" || text === "justify" || text === "left") {
    return text;
  }
  return "left";
}

export const Label: React.FC<any> = (props) => {
  const {
    text = "",
    color = "",
    size,
    weight,
    align,
    htmlFor,
    tooltip,
    wrap,
    autoHeight,
    overflow,
    italic,
    underline,
    lineHeight,
  } = props;
  const label = useResolvedPropertyText(text);
  const colorValue = useResolvedPropertyText(color) || undefined;
  const resolvedTooltip = useResolvedPropertyText(tooltip);
  const chrome = useControlChrome(props, { includeText: true });
  const overflowMode = readPropertyText(overflow).toLowerCase();
  const shouldWrap = readBooleanProperty(wrap, true);
  const grow = readBooleanProperty(autoHeight, false);
  const line = readOptionalNumber(lineHeight);
  const style: React.CSSProperties = {
    display: "block",
    width: "100%",
    minHeight: grow ? undefined : 18,
    height: grow ? "auto" : undefined,
    boxSizing: "border-box",
    whiteSpace: shouldWrap ? "normal" : "nowrap",
    overflow: overflowMode === "scroll" ? "auto" : overflowMode === "hidden" || overflowMode === "ellipsis" ? "hidden" : undefined,
    textOverflow: overflowMode === "ellipsis" ? "ellipsis" : undefined,
    fontStyle: readBooleanProperty(italic, false) ? "italic" : undefined,
    textDecoration: readBooleanProperty(underline, false) ? "underline" : undefined,
    lineHeight: line,
    ...chrome.style,
  };
  style.color = chrome.style.color || colorValue || "var(--color-text-primary, #1c1c1e)";
  style.fontSize = chrome.style.fontSize ?? resolveFontSize(size);
  style.fontWeight = chrome.style.fontWeight ?? resolveFontWeight(weight);
  style.textAlign = chrome.style.textAlign ?? resolveTextAlign(align);
  if (htmlFor) {
    return (
      <label htmlFor={String(htmlFor)} title={resolvedTooltip || undefined} style={style}>
        {label}
      </label>
    );
  }
  return (
    <span title={resolvedTooltip || undefined} style={style}>
      {label}
    </span>
  );
};
export default Label;
