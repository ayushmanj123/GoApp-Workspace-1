import React from "react";

export const Container: React.FC<any> = ({
  children,
  direction = "row",
  style,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: direction,
        gap: 8,
        ...(style || {}),
      }}
    >
      {children}
    </div>
  );
};
export default Container;
