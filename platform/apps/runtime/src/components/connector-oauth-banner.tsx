import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { AppPackage, RuntimeConnector } from "../runtime-types";
import { connectorsOAuthApi } from "../api/connectors-oauth-api";

function isUserScopedOAuth(connector: RuntimeConnector): boolean {
  if (connector.authentication_type !== "oauth_authorization_code") {
    return false;
  }
  const scope = String(connector.auth_config?.connection_scope ?? "app").toLowerCase();
  return scope === "user";
}

export const ConnectorOAuthBanner: React.FC<{
  pkg?: AppPackage;
  onConnected?: () => void;
}> = ({ pkg, onConnected }) => {
  const candidates = useMemo(
    () => (pkg?.connectors ?? []).filter(isUserScopedOAuth),
    [pkg],
  );
  const [pending, setPending] = useState<RuntimeConnector[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (candidates.length === 0) {
      setPending([]);
      return;
    }
    const needs: RuntimeConnector[] = [];
    for (const connector of candidates) {
      try {
        const status = await connectorsOAuthApi.getConnection(connector.id);
        if (!status.connected) needs.push(connector);
      } catch {
        needs.push(connector);
      }
    }
    setPending(needs);
  }, [candidates]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth") === "connected") {
      setBanner("Connector connected. Reloading data…");
      params.delete("oauth");
      params.delete("id");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", next);
      void (async () => {
        await refresh();
        onConnected?.();
      })();
    }
  }, [refresh, onConnected]);

  const handleConnect = async (connector: RuntimeConnector) => {
    setConnectingId(connector.id);
    setError(null);
    try {
      const { authorize_url } = await connectorsOAuthApi.startOAuth(
        connector.id,
        "runtime",
      );
      window.location.assign(authorize_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start OAuth");
      setConnectingId(null);
    }
  };

  if (candidates.length === 0 && !banner) return null;
  if (pending.length === 0 && !banner && !error) return null;

  return (
    <div
      data-testid="connector-oauth-banner"
      style={{
        marginBottom: 12,
        padding: "10px 12px",
        border: "1px solid #ccc",
        background: "#f7f7f7",
        fontSize: 13,
      }}
    >
      {banner ? <div style={{ marginBottom: 8 }}>{banner}</div> : null}
      {error ? (
        <div style={{ marginBottom: 8, color: "#a00" }}>{error}</div>
      ) : null}
      {pending.length > 0 ? (
        <>
          <div style={{ marginBottom: 8 }}>
            Connect your account to use these connectors:
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {pending.map((connector) => (
              <li key={connector.id} style={{ marginBottom: 6 }}>
                <strong>{connector.name}</strong>{" "}
                <button
                  type="button"
                  data-testid={`connector-oauth-connect-${connector.id}`}
                  disabled={connectingId === connector.id}
                  onClick={() => void handleConnect(connector)}
                  style={{ marginLeft: 8 }}
                >
                  {connectingId === connector.id ? "Starting…" : "Connect"}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
};

export default ConnectorOAuthBanner;
