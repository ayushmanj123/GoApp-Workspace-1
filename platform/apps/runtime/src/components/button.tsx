import React from "react";

export const Button: React.FC<any> = ({
  text = "Button",
  disabled = false,
  onClick,
}) => {
  return (
    <button disabled={disabled} onClick={onClick}>
      {text}
    </button>
  );
};
export default Button;
