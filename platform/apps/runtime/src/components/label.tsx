import React from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";

export const Label: React.FC<any> = ({ text = "", color = "" }) => {
  const label = useResolvedPropertyText(text);
  const colorValue = useResolvedPropertyText(color) || undefined;
  return (
    <span style={colorValue ? { color: colorValue } : undefined}>{label}</span>
  );
};
export default Label;
