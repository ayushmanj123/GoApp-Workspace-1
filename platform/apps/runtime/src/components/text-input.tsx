import React from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";

export const TextInput: React.FC<any> = ({
  value = "",
  placeholder = "",
  onChange,
}) => {
  const resolvedValue = useResolvedPropertyText(value);
  const resolvedPlaceholder = useResolvedPropertyText(placeholder);

  return (
    <input
      value={resolvedValue}
      placeholder={resolvedPlaceholder}
      onChange={(event) => onChange && onChange(event.target.value)}
    />
  );
};
export default TextInput;
