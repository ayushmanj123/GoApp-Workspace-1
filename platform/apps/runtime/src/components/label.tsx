import React from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";

export const Label: React.FC<any> = ({ text = "", color = "" }) => {
  const label = useResolvedPropertyText(text);
  const colorValue = useResolvedPropertyText(color) || undefined;
  return (
    <span
      style={{
        ...(colorValue ? { color: colorValue } : {}),
        display: "block",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {label}
    </span>
  );
};
export default Label;
