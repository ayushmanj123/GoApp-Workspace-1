import React from "react";

export const ErrorState: React.FC<{ message?: string; onRetry?: () => void }> = ({
  message,
  onRetry,
}) => (
  <div role="alert" style={{ padding: 24 }}>
    <div>{message || "An error occurred"}</div>
    {onRetry ? (
      <button type="button" style={{ marginTop: 12 }} onClick={onRetry}>
        Retry
      </button>
    ) : null}
  </div>
);
export default ErrorState;
