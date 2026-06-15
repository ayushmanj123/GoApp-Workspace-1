import React from "react";

export const TextInput: React.FC<any> = ({
  value = "",
  placeholder = "",
  onChange,
}) => {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange && onChange(e.target.value)}
    />
  );
};
export default TextInput;
