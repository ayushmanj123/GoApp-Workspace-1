import { Suspense } from "react";
import { useParams } from "react-router-dom";
import { RuntimeProvider } from "../runtime-provider";
import RuntimeRenderer from "../runtime-renderer";
import LoadingState from "../components/loading-state";
import ErrorState from "../components/error-state";
import registerRuntime from "../registry-bridge";

registerRuntime();

export const ScreenPage = () => {
  const { applicationId, screenId } = useParams();
  if (!applicationId || !screenId)
    return <ErrorState message="missing params" />;
  // Provide app package then navigate to screen
  return (
    <RuntimeProvider appId={applicationId}>
      <ScreenLoader />
    </RuntimeProvider>
  );
};

const ScreenLoader = () => {
  // navigate when provider loads
  return (
    <Suspense fallback={<LoadingState />}>
      <RuntimeRenderer />
    </Suspense>
  );
};

export default ScreenPage;
