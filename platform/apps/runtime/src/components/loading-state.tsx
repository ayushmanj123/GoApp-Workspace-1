import React from "react";
export const LoadingState: React.FC<{ message?: string }> = ({ message }) => (
  <div aria-busy="true">{message || "Loading..."}</div>
);
export default LoadingState;
