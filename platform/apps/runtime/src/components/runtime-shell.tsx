import React, { useCallback } from "react";
import { useRuntime } from "../runtime-hooks";
import RuntimeRenderer from "../runtime-renderer";
import LoadingState from "./loading-state";
import ErrorState from "./error-state";
import ConnectorOAuthBanner from "./connector-oauth-banner";

export const RuntimeShell: React.FC = () => {
  const ctx = useRuntime();
  const reload = useCallback(() => {
    window.location.reload();
  }, []);
  if (ctx.loading) return <LoadingState />;
  if (ctx.loadError) {
    return (
      <ErrorState
        message={ctx.loadError}
        onRetry={reload}
      />
    );
  }
  if (!ctx.pkg) return <ErrorState message="Package not found" onRetry={reload} />;
  return (
    <div style={{ padding: 12 }}>
      <ConnectorOAuthBanner pkg={ctx.pkg} onConnected={reload} />
      {ctx.notice ? (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            background: "#e8f0fe",
            color: "#1a56db",
            borderRadius: 6,
          }}
        >
          {ctx.notice}
        </div>
      ) : null}
      {ctx.actionError ? (
        <div
          role="alert"
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            background: "#fde8e8",
            color: "#9b1c1c",
            borderRadius: 6,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <span>{ctx.actionError}</span>
          <button type="button" onClick={() => ctx.clearActionError?.()}>
            Dismiss
          </button>
        </div>
      ) : null}
      <RuntimeRenderer />
    </div>
  );
};

export default RuntimeShell;
