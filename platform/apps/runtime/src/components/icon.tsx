import React, { useCallback } from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
import { useRuntimeActionHandler } from "../hooks/use-runtime-action-handler";
import { useControlChrome } from "../hooks/use-control-chrome";
import { readOptionalNumber } from "../utils/appearance-style";
import { iconGlyph } from "../utils/icon-glyphs";

function hasActionFormula(property: unknown): boolean {
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    return typeof formula === "string" && formula.trim().length > 0;
  }
  return false;
}

export const Icon: React.FC<any> = (props) => {
  const {
    icon = "star",
    color = "#333333",
    onSelect,
    controlName,
    name,
    disabled = false,
    readOnly = false,
    tooltip,
    rotation,
    size,
  } = props;
  const iconName = useResolvedPropertyText(icon, "star");
  const resolvedColor = useResolvedPropertyText(color, "#333333");
  const resolvedTooltip = useResolvedPropertyText(tooltip);
  const glyph = iconGlyph(iconName);
  const chrome = useControlChrome(props, { disabled: Boolean(disabled), includeText: false });
  const degrees = readOptionalNumber(rotation);
  const iconSize = readOptionalNumber(size);
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

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        cursor: clickable ? "pointer" : undefined,
        ...chrome.style,
        fontSize: iconSize && iconSize > 0 ? iconSize : "min(32px, 80%)",
        color: chrome.style.color || resolvedColor,
        transform: degrees != null ? `rotate(${degrees}deg)` : undefined,
      }}
      title={resolvedTooltip || undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? (chrome.tabIndex ?? 0) : chrome.tabIndex}
      onClick={clickable ? onActivate : undefined}
      onKeyDown={clickable ? onKeyDown : undefined}
    >
      {glyph}
    </div>
  );
};
export default Icon;
