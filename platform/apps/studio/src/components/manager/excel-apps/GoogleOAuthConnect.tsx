import { connectorsApi } from "../../../api/connectors-api";
import { Button } from "../../ui";

interface GoogleOAuthConnectProps {
  connectorId: string;
  connected: boolean;
  onConnected?: () => void;
  label?: string;
}

export function GoogleOAuthConnect({
  connectorId,
  connected,
  onConnected,
  label = "Connect Google",
}: GoogleOAuthConnectProps) {
  const handleConnect = async () => {
    const { authorize_url } = await connectorsApi.startOAuth(connectorId, "studio");
    window.open(authorize_url, "_blank", "noopener,noreferrer");
    onConnected?.();
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <Button variant="secondary" size="sm" onClick={() => void handleConnect()}>
        {connected ? "Reconnect Google" : label}
      </Button>
      <span style={{ fontSize: 12, color: "var(--color-text-muted, #666)" }}>
        {connected ? "Google account connected" : "Authorize access to Google Drive spreadsheets"}
      </span>
    </div>
  );
}
