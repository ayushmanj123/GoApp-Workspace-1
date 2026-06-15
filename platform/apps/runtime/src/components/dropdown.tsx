import React from "react";

export const Dropdown: React.FC<any> = ({ options = [], value, onChange }) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
    >
      {options.map((opt: any, idx: number) => (
        <option key={idx} value={opt.value}>
          {opt.label ?? opt}
        </option>
      ))}
    </select>
  );
};
export default Dropdown;
