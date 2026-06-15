import React from "react";
export const ErrorState: React.FC<{ message?: string }> = ({ message }) => (
  <div role="alert">{message || "An error occurred"}</div>
);
export default ErrorState;
