import React from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";

export const Label: React.FC<any> = ({ text = "", color = "", htmlFor }) => {
  const label = useResolvedPropertyText(text);
  const colorValue = useResolvedPropertyText(color) || undefined;
  const style: React.CSSProperties = {
    color: colorValue || "var(--color-text-primary, #1c1c1e)",
    display: "block",
    width: "100%",
    minHeight: 18,
    boxSizing: "border-box",
    fontSize: 12,
    fontWeight: 600,
  };
  if (htmlFor) {
    return (
      <label htmlFor={String(htmlFor)} style={style}>
        {label}
      </label>
    );
  }
  return <span style={style}>{label}</span>;
};
export default Label;
