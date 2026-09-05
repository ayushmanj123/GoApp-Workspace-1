import React, { useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { RuntimeProvider } from "../runtime-provider";
import RuntimeRenderer from "../runtime-renderer";
import LoadingState from "../components/loading-state";
import ErrorState from "../components/error-state";
import ConnectorOAuthBanner from "../components/connector-oauth-banner";
import registerRuntime from "../registry-bridge";
import { useRuntime } from "../runtime-hooks";

registerRuntime();

export const ApplicationPage: React.FC = () => {
  const { applicationId } = useParams();
  const [params] = useSearchParams();
  const environmentId = params.get("environmentId") ?? undefined;
  const channelParam = (params.get("channel") ?? "").trim().toLowerCase();
  const channel: "draft" | "published" =
    channelParam === "draft" ? "draft" : "published";
  if (!applicationId) return <ErrorState message="application id missing" />;

  return (
    <RuntimeProvider
      appId={applicationId}
      environmentId={environmentId}
      channel={channel}
    >
      <InnerApp />
    </RuntimeProvider>
  );
};

const InnerApp: React.FC = () => {
  const ctx = useRuntime();
  const reload = useCallback(() => {
    window.location.reload();
  }, []);
  return (
    <React.Suspense fallback={<LoadingState />}>
      <div style={{ padding: 12 }}>
        <ConnectorOAuthBanner pkg={ctx.pkg} onConnected={reload} />
        <RuntimeRenderer />
      </div>
    </React.Suspense>
  );
};

export default ApplicationPage;
