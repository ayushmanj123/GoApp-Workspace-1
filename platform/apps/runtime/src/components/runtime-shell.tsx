import React from "react";
import { useRuntime } from "../runtime-hooks";
import RuntimeRenderer from "../runtime-renderer";
import LoadingState from "./loading-state";
import ErrorState from "./error-state";

export const RuntimeShell: React.FC = () => {
  const ctx = useRuntime();
  if (ctx.loading) return <LoadingState />;
  if (!ctx.pkg) return <ErrorState message="Package not found" />;
  return (
    <div style={{ padding: 12 }}>
      <RuntimeRenderer />
    </div>
  );
};

export default RuntimeShell;
