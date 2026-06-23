import React from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";

export const Button: React.FC<any> = ({
  text = "Button",
  disabled = false,
  onClick,
}) => {
  const label = useResolvedPropertyText(text, "Button");
  return (
    <button disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
};
export default Button;
