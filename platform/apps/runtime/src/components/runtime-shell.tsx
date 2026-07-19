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
  if (!ctx.pkg) return <ErrorState message="Package not found" />;
  return (
    <div style={{ padding: 12 }}>
      <ConnectorOAuthBanner pkg={ctx.pkg} onConnected={reload} />
      <RuntimeRenderer />
    </div>
  );
};

export default RuntimeShell;
