import React, { useCallback } from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
import { useRuntimeActionHandler } from "../hooks/use-runtime-action-handler";

const GLYPHS: Record<string, string> = {
  star: "★",
  heart: "♥",
  check: "✓",
  home: "⌂",
  user: "👤",
  settings: "⚙",
};

function hasActionFormula(property: unknown): boolean {
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    return typeof formula === "string" && formula.trim().length > 0;
  }
  return false;
}

export const Icon: React.FC<any> = ({
  icon = "star",
  color = "#333333",
  onSelect,
  controlName,
  name,
  disabled = false,
  readOnly = false,
}) => {
  const iconName = useResolvedPropertyText(icon, "star");
  const resolvedColor = useResolvedPropertyText(color, "#333333");
  const glyph =
    GLYPHS[iconName.toLowerCase()] ??
    (iconName.length <= 2 ? iconName : "●");
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
        fontSize: "min(32px, 80%)",
        color: resolvedColor,
        boxSizing: "border-box",
        cursor: clickable ? "pointer" : undefined,
      }}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onActivate : undefined}
      onKeyDown={clickable ? onKeyDown : undefined}
    >
      {glyph}
    </div>
  );
};
export default Icon;
