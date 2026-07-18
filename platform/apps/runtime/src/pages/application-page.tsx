import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { RuntimeProvider } from "../runtime-provider";
import RuntimeRenderer from "../runtime-renderer";
import LoadingState from "../components/loading-state";
import ErrorState from "../components/error-state";
import registerRuntime from "../registry-bridge";

registerRuntime();

export const ApplicationPage: React.FC = () => {
  const { applicationId } = useParams();
  const [params] = useSearchParams();
  const environmentId = params.get("environmentId") ?? undefined;
  if (!applicationId) return <ErrorState message="application id missing" />;

  return (
    <RuntimeProvider appId={applicationId} environmentId={environmentId}>
      <InnerApp />
    </RuntimeProvider>
  );
};

const InnerApp: React.FC = () => {
  return (
    <React.Suspense fallback={<LoadingState />}>
      <RuntimeRenderer />
    </React.Suspense>
  );
};

export default ApplicationPage;
