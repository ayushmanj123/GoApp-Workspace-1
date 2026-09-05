import React, { useCallback } from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
import { useRuntimeActionHandler } from "../hooks/use-runtime-action-handler";

function hasActionFormula(property: unknown): boolean {
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    return typeof formula === "string" && formula.trim().length > 0;
  }
  return false;
}

export const Image: React.FC<any> = ({
  src,
  alt = "",
  onSelect,
  controlName,
  name,
  disabled = false,
  readOnly = false,
}) => {
  const resolvedSrc = useResolvedPropertyText(src, "");
  const resolvedAlt = useResolvedPropertyText(alt, "Image");
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
        tabIndex: 0,
        onClick: onActivate,
        onKeyDown,
      }
    : {};

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
        }}
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
        objectFit: "contain",
        boxSizing: "border-box",
        cursor: clickable ? "pointer" : undefined,
      }}
      {...interactiveProps}
    />
  );
};
export default Image;
