import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  connectorsApi,
  type AuthenticationType,
  type ConnectorActionRecord,
  type ConnectorAuthConfig,
  type ConnectorRecord,
} from "../../../api/connectors-api";
import { Button } from "../../ui";
import { CreateActionModal } from "./CreateActionModal";
import styles from "./connectors-manager.module.css";

function parseAuthConfig(
  raw: ConnectorRecord["auth_config"],
): ConnectorAuthConfig {
  if (!raw || typeof raw !== "object") return { type: "none" };
  const cfg = raw as ConnectorAuthConfig;
  if (cfg.type === "connection_string") {
    return {
      type: "connection_string",
      secret_id: cfg.secret_id,
      table: cfg.table ?? "",
      primary_key: cfg.primary_key ?? "id",
    };
  }
  if (cfg.type === "oauth_client_credentials") {
    return {
      type: "oauth_client_credentials",
      secret_id: cfg.secret_id,
      token_url: cfg.token_url ?? "",
      client_id: cfg.client_id ?? "",
      scope: cfg.scope ?? "",
    };
  }
  if (cfg.type === "oauth_authorization_code") {
    return {
      type: "oauth_authorization_code",
      secret_id: cfg.secret_id,
      refresh_secret_id: cfg.refresh_secret_id,
      token_url: cfg.token_url ?? "",
      authorization_url: cfg.authorization_url ?? "",
      client_id: cfg.client_id ?? "",
      scope: cfg.scope ?? "",
      connection_scope: cfg.connection_scope === "user" ? "user" : "app",
    };
  }
  if (cfg.type === "s3") {
    return {
      type: "s3",
      secret_id: cfg.secret_id,
      endpoint: cfg.endpoint ?? "",
      bucket: cfg.bucket ?? "",
      access_key_id: cfg.access_key_id ?? "",
      use_ssl: cfg.use_ssl,
      prefix: cfg.prefix ?? "",
    };
  }
  return {
    type: cfg.type === "header" ? "header" : "none",
    header_name: cfg.header_name ?? "X-Api-Key",
    secret_id: cfg.secret_id,
  };
}

export function ConnectorDetailView() {
  const { connectorId } = useParams<{ connectorId: string }>();
  const navigate = useNavigate();
  const [connector, setConnector] = useState<ConnectorRecord | null>(null);
  const [actions, setActions] = useState<ConnectorActionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createActionOpen, setCreateActionOpen] = useState(false);
  const [removingAction, setRemovingAction] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authType, setAuthType] = useState<AuthenticationType>("none");
  const [headerName, setHeaderName] = useState("X-Api-Key");
  const [headerValue, setHeaderValue] = useState("");
  const [connectionString, setConnectionString] = useState("");
  const [table, setTable] = useState("");
  const [primaryKey, setPrimaryKey] = useState("id");
  const [hasSecret, setHasSecret] = useState(false);
  const [tokenUrl, setTokenUrl] = useState("");
  const [authorizationUrl, setAuthorizationUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [scope, setScope] = useState("");
  const [connectionScope, setConnectionScope] = useState<"app" | "user">("app");
  const [hasConnection, setHasConnection] = useState(false);
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [oauthBanner, setOauthBanner] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [bucket, setBucket] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [useSsl, setUseSsl] = useState(false);
  const [prefix, setPrefix] = useState("");

  const isSql = connector?.connector_type === "sql";
  const isStorage = connector?.connector_type === "storage";

  const load = useCallback(async () => {
    if (!connectorId) return;
    setLoading(true);
    setError(null);
    try {
      const conn = await connectorsApi.get(connectorId);
      setConnector(conn);
      setName(conn.name);
      setBaseUrl(conn.base_url ?? "");
      setHasSecret(Boolean(conn.has_secret));
      setHasConnection(Boolean(conn.has_connection));
      const cfg = parseAuthConfig(conn.auth_config);

      if (conn.connector_type === "sql") {
        setAuthType("connection_string");
        setTable(cfg.table ?? "");
        setPrimaryKey(cfg.primary_key ?? "id");
        setConnectionString("");
        const actionPage = await connectorsApi.listActions(connectorId);
        setActions(actionPage.items ?? []);
      } else if (conn.connector_type === "storage") {
        setAuthType("s3");
        setEndpoint(cfg.endpoint ?? "");
        setBucket(cfg.bucket ?? "");
        setAccessKeyId(cfg.access_key_id ?? "");
        setSecretAccessKey("");
        setUseSsl(Boolean(cfg.use_ssl));
        setPrefix(cfg.prefix ?? "");
        setActions([]);
      } else {
        setAuthType(
          conn.authentication_type === "oauth_authorization_code"
            ? "oauth_authorization_code"
            : conn.authentication_type === "oauth_client_credentials"
              ? "oauth_client_credentials"
              : conn.authentication_type === "header"
                ? "header"
                : "none",
        );
        setHeaderName(cfg.header_name ?? "X-Api-Key");
        setHeaderValue("");
        setTokenUrl(cfg.token_url ?? "");
        setAuthorizationUrl(cfg.authorization_url ?? "");
        setClientId(cfg.client_id ?? "");
        setClientSecret("");
        setScope(cfg.scope ?? "");
        setConnectionScope(cfg.connection_scope === "user" ? "user" : "app");
        if (
          conn.authentication_type === "oauth_authorization_code" &&
          cfg.connection_scope === "user"
        ) {
          try {
            const status = await connectorsApi.getOAuthConnection(connectorId);
            if (!cancelled) setHasConnection(Boolean(status.connected));
          } catch {
            if (!cancelled) setHasConnection(false);
          }
        }
        const actionPage = await connectorsApi.listActions(connectorId);
        setActions(actionPage.items ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connector");
    } finally {
      setLoading(false);
    }
  }, [connectorId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth") === "connected") {
      setOauthBanner(
        "OAuth connection saved. Runtime can refresh access tokens for this connector.",
      );
      params.delete("oauth");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", next);
      void load();
    }
  }, [load]);

  const handleConnectOAuth = async () => {
    if (!connectorId) return;
    setOauthConnecting(true);
    setError(null);
    try {
      const { authorize_url } = await connectorsApi.startOAuth(connectorId, "studio");
      window.open(authorize_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start OAuth");
    } finally {
      setOauthConnecting(false);
    }
  };

  const handleSave = async () => {
    if (!connectorId || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let authentication_type: AuthenticationType = authType;
      let auth_config: ConnectorAuthConfig = { type: "none" };
      let base_url = baseUrl.trim();

      if (isSql) {
        authentication_type = "connection_string";
        base_url = "";
        auth_config = {
          type: "connection_string",
          ...(table.trim() ? { table: table.trim() } : {}),
          ...(primaryKey.trim() ? { primary_key: primaryKey.trim() } : {}),
          ...(connectionString.trim()
            ? { connection_string: connectionString.trim() }
            : {}),
        };
      } else if (isStorage) {
        authentication_type = "s3";
        base_url = "";
        auth_config = {
          type: "s3",
          endpoint: endpoint.trim(),
          bucket: bucket.trim(),
          access_key_id: accessKeyId.trim(),
          use_ssl: useSsl,
          ...(prefix.trim() ? { prefix: prefix.trim() } : {}),
          ...(secretAccessKey.trim()
            ? { secret_access_key: secretAccessKey.trim() }
            : {}),
        };
      } else if (authType === "header") {
        auth_config = {
          type: "header",
          header_name: headerName.trim() || "X-Api-Key",
          ...(headerValue.trim() ? { header_value: headerValue.trim() } : {}),
        };
      } else if (authType === "oauth_client_credentials") {
        authentication_type = "oauth_client_credentials";
        auth_config = {
          type: "oauth_client_credentials",
          token_url: tokenUrl.trim(),
          client_id: clientId.trim(),
          ...(scope.trim() ? { scope: scope.trim() } : {}),
          ...(clientSecret.trim() ? { client_secret: clientSecret.trim() } : {}),
        };
      } else if (authType === "oauth_authorization_code") {
        authentication_type = "oauth_authorization_code";
        auth_config = {
          type: "oauth_authorization_code",
          authorization_url: authorizationUrl.trim(),
          token_url: tokenUrl.trim(),
          client_id: clientId.trim(),
          connection_scope: connectionScope,
          ...(scope.trim() ? { scope: scope.trim() } : {}),
          ...(clientSecret.trim() ? { client_secret: clientSecret.trim() } : {}),
        };
      }

      const updated = await connectorsApi.update(connectorId, {
        name: name.trim(),
        base_url,
        authentication_type,
        auth_config,
      });
      setConnector(updated);
      setHasSecret(Boolean(updated.has_secret));
      setHasConnection(Boolean(updated.has_connection));
      setHeaderValue("");
      setConnectionString("");
      setClientSecret("");
      setSecretAccessKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save connector");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAction = async (action: ConnectorActionRecord) => {
    const confirmed = window.confirm(`Delete action "${action.action_name}"?`);
    if (!confirmed) return;
    setRemovingAction(action.id);
    try {
      await connectorsApi.removeAction(action.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete action");
    } finally {
      setRemovingAction(null);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading connector…</div>;
  }

  if (!connector) {
    return (
      <div className={styles.error}>
        {error ?? "Connector not found."}
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" size="sm" onClick={() => navigate("/studio/connectors")}>
            Back to connectors
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className={styles.backLink}
        onClick={() => navigate("/studio/connectors")}
      >
        ← Back to connectors
      </button>

      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{connector.name}</h1>
          <p className={styles.subtitle}>
            {isSql
              ? "SQL"
              : isStorage
                ? "Storage"
                : "REST"}{" "}
            connector · bind Gallery Items to <code>{connector.name}</code>
            {isStorage
              ? " · upload via Form/Patch (key + content); delete via Remove(Connector, ThisItem)"
              : null}
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={() => void handleSave()}
          disabled={saving || !name.trim()}
          data-testid="connector-save-btn"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
      {oauthBanner ? (
        <div className={styles.empty} data-testid="oauth-connected-banner">
          {oauthBanner}
        </div>
      ) : null}

      <div className={styles.formGrid}>
        <div>
          <label className={styles.fieldLabel} htmlFor="connector-name">
            Name
          </label>
          <input
            id="connector-name"
            className={styles.fieldInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="connector-detail-name"
          />
        </div>

        {isSql ? (
          <>
            <div>
              <label className={styles.fieldLabel} htmlFor="connector-table">
                Table / view
              </label>
              <input
                id="connector-table"
                className={styles.fieldInput}
                value={table}
                onChange={(e) => setTable(e.target.value)}
                placeholder="public.orders"
                data-testid="connector-detail-table"
              />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="connector-pk">
                Primary key
              </label>
              <input
                id="connector-pk"
                className={styles.fieldInput}
                value={primaryKey}
                onChange={(e) => setPrimaryKey(e.target.value)}
                placeholder="id"
                data-testid="connector-detail-primary-key"
              />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="connector-dsn">
                Connection string
              </label>
              <input
                id="connector-dsn"
                className={styles.fieldInput}
                type="password"
                autoComplete="new-password"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                placeholder={
                  hasSecret
                    ? "•••••••• (unchanged unless you type a new value)"
                    : "postgres://..."
                }
                data-testid="connector-detail-connection-string"
              />
            </div>
          </>
        ) : isStorage ? (
          <>
            <div>
              <label className={styles.fieldLabel} htmlFor="storage-endpoint">
                Endpoint
              </label>
              <input
                id="storage-endpoint"
                className={styles.fieldInput}
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
              />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="storage-bucket">
                Bucket
              </label>
              <input
                id="storage-bucket"
                className={styles.fieldInput}
                value={bucket}
                onChange={(e) => setBucket(e.target.value)}
              />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="storage-access-key">
                Access key ID
              </label>
              <input
                id="storage-access-key"
                className={styles.fieldInput}
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
              />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="storage-secret">
                Secret access key
              </label>
              <input
                id="storage-secret"
                className={styles.fieldInput}
                type="password"
                autoComplete="new-password"
                value={secretAccessKey}
                onChange={(e) => setSecretAccessKey(e.target.value)}
                placeholder={
                  hasSecret ? "•••••••• (unchanged unless you type a new value)" : ""
                }
              />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="storage-prefix">
                Prefix
              </label>
              <input
                id="storage-prefix"
                className={styles.fieldInput}
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
              />
            </div>
            <label className={styles.fieldLabel} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={useSsl}
                onChange={(e) => setUseSsl(e.target.checked)}
              />
              Use SSL
            </label>
          </>
        ) : (
          <>
            <div>
              <label className={styles.fieldLabel} htmlFor="connector-base-url">
                Base URL
              </label>
              <input
                id="connector-base-url"
                className={styles.fieldInput}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
                data-testid="connector-detail-base-url"
              />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="connector-auth">
                Authentication
              </label>
              <select
                id="connector-auth"
                className={styles.fieldSelect}
                value={authType}
                onChange={(e) => setAuthType(e.target.value as AuthenticationType)}
              >
                <option value="none">None</option>
                <option value="header">Static header</option>
                <option value="oauth_client_credentials">OAuth client credentials</option>
                <option value="oauth_authorization_code">OAuth authorization code</option>
              </select>
            </div>
            {authType === "header" ? (
              <>
                <div>
                  <label className={styles.fieldLabel} htmlFor="header-name">
                    Header name
                  </label>
                  <input
                    id="header-name"
                    className={styles.fieldInput}
                    value={headerName}
                    onChange={(e) => setHeaderName(e.target.value)}
                  />
                </div>
                <div>
                  <label className={styles.fieldLabel} htmlFor="header-value">
                    API key / header value
                  </label>
                  <input
                    id="header-value"
                    className={styles.fieldInput}
                    type="password"
                    autoComplete="new-password"
                    value={headerValue}
                    onChange={(e) => setHeaderValue(e.target.value)}
                    placeholder={
                      hasSecret ? "•••••••• (unchanged unless you type a new value)" : ""
                    }
                    data-testid="connector-detail-header-value"
                  />
                </div>
              </>
            ) : null}
            {authType === "oauth_client_credentials" ||
            authType === "oauth_authorization_code" ? (
              <>
                {authType === "oauth_authorization_code" ? (
                  <div>
                    <label className={styles.fieldLabel} htmlFor="authorization-url">
                      Authorization URL
                    </label>
                    <input
                      id="authorization-url"
                      className={styles.fieldInput}
                      value={authorizationUrl}
                      onChange={(e) => setAuthorizationUrl(e.target.value)}
                      placeholder="https://idp.example.com/oauth/authorize"
                      data-testid="connector-detail-authorization-url"
                    />
                  </div>
                ) : null}
                <div>
                  <label className={styles.fieldLabel} htmlFor="token-url">
                    Token URL
                  </label>
                  <input
                    id="token-url"
                    className={styles.fieldInput}
                    value={tokenUrl}
                    onChange={(e) => setTokenUrl(e.target.value)}
                  />
                </div>
                <div>
                  <label className={styles.fieldLabel} htmlFor="client-id">
                    Client ID
                  </label>
                  <input
                    id="client-id"
                    className={styles.fieldInput}
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  />
                </div>
                <div>
                  <label className={styles.fieldLabel} htmlFor="client-secret">
                    Client secret
                  </label>
                  <input
                    id="client-secret"
                    className={styles.fieldInput}
                    type="password"
                    autoComplete="new-password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder={
                      hasSecret ? "•••••••• (unchanged unless you type a new value)" : ""
                    }
                  />
                </div>
                <div>
                  <label className={styles.fieldLabel} htmlFor="oauth-scope">
                    Scope
                  </label>
                  <input
                    id="oauth-scope"
                    className={styles.fieldInput}
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                  />
                </div>
                {authType === "oauth_authorization_code" ? (
                  <>
                    <div>
                      <label className={styles.fieldLabel} htmlFor="connection-scope">
                        Connection scope
                      </label>
                      <select
                        id="connection-scope"
                        className={styles.fieldSelect}
                        value={connectionScope}
                        onChange={(e) =>
                          setConnectionScope(e.target.value === "user" ? "user" : "app")
                        }
                        data-testid="connector-detail-connection-scope"
                      >
                        <option value="app">App (shared)</option>
                        <option value="user">Per-user</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void handleConnectOAuth()}
                        disabled={oauthConnecting}
                        data-testid="connector-oauth-connect-btn"
                      >
                        {oauthConnecting
                          ? "Starting…"
                          : connectionScope === "user"
                            ? hasConnection
                              ? "Reconnect as me"
                              : "Connect as me"
                            : hasConnection
                              ? "Reconnect"
                              : "Connect"}
                      </Button>
                      <span style={{ fontSize: 12, color: "var(--color-text-muted, #666)" }}>
                        {connectionScope === "user"
                          ? hasConnection
                            ? "Connected as you (per-user — runtime users connect separately)"
                            : "Per-user — each runtime user Connects; Connect as me for testing"
                          : hasConnection
                            ? "Connected (app-level refresh token stored)"
                            : "Not connected — authorize once for this app"}
                      </span>
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>

      {!isStorage ? (
        <>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{isSql ? "Named queries" : "Actions"}</h2>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setCreateActionOpen(true)}
          data-testid="new-action-btn"
        >
          {isSql ? "+ Add Query" : "+ Add Action"}
        </Button>
      </div>

      {actions.length === 0 ? (
        <div className={styles.empty}>
          {isSql ? (
            <>
              Optional: add a <code>list</code> query (SELECT) to override table binding. Otherwise
              galleries use <code>SELECT * FROM {"{table}"}</code>.
            </>
          ) : (
            <>
              No actions yet. Add a <code>list</code> action (GET) so galleries can load rows.
            </>
          )}
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              {!isSql ? <th>Method</th> : null}
              <th>{isSql ? "Query" : "Endpoint"}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {actions.map((action) => (
              <tr key={action.id} data-testid={`action-row-${action.action_name}`}>
                <td className={styles.mono}>{action.action_name}</td>
                {!isSql ? <td>{action.http_method}</td> : null}
                <td className={styles.mono}>{action.endpoint}</td>
                <td>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleDeleteAction(action)}
                    disabled={removingAction === action.id}
                  >
                    {removingAction === action.id ? "…" : "Delete"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {connectorId ? (
        <CreateActionModal
          open={createActionOpen}
          connectorId={connectorId}
          mode={isSql ? "sql" : "rest"}
          onClose={() => setCreateActionOpen(false)}
          onCreated={() => void load()}
        />
      ) : null}
        </>
      ) : (
        <div className={styles.empty}>
          Storage connectors list objects from the bucket (optional prefix). Bind Gallery Items to{" "}
          <code>{connector.name}</code>.
        </div>
      )}
    </>
  );
}
