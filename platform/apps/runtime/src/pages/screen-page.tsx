import React from "react";
import { useParams } from "react-router-dom";
import { RuntimeProvider } from "../runtime-provider";
import RuntimeRenderer from "../runtime-renderer";
import LoadingState from "../components/loading-state";
import ErrorState from "../components/error-state";
import registerRuntime from "../registry-bridge";

registerRuntime();

export const ScreenPage: React.FC = () => {
  const { applicationId, screenId } = useParams();
  if (!applicationId || !screenId)
    return <ErrorState message="missing params" />;
  // Provide app package then navigate to screen
  return (
    <RuntimeProvider appId={applicationId}>
      <ScreenLoader screenId={screenId} />
    </RuntimeProvider>
  );
};

const ScreenLoader: React.FC<{ screenId?: string }> = ({ screenId }) => {
  // navigate when provider loads
  return (
    <React.Suspense fallback={<LoadingState />}>
      <RuntimeRenderer />
    </React.Suspense>
  );
};

export default ScreenPage;
