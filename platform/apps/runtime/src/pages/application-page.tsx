import React from "react";
import { useParams } from "react-router-dom";
import { RuntimeProvider } from "../runtime-provider";
import RuntimeRenderer from "../runtime-renderer";
import LoadingState from "../components/loading-state";
import ErrorState from "../components/error-state";
import registerRuntime from "../registry-bridge";

registerRuntime();

export const ApplicationPage: React.FC = () => {
  const { applicationId } = useParams();
  if (!applicationId) return <ErrorState message="application id missing" />;

  return (
    <RuntimeProvider appId={applicationId}>
      <InnerApp />
    </RuntimeProvider>
  );
};

const InnerApp: React.FC = () => {
  // consume context directly inside provider children
  // lazy render - show loading or error using RuntimeRenderer's own checks
  return (
    <React.Suspense fallback={<LoadingState />}>
      <RuntimeRenderer />
    </React.Suspense>
  );
};

export default ApplicationPage;
