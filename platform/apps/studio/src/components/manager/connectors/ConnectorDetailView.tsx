import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  connectorsApi,
  type AuthenticationType,
  type ConnectorActionRecord,
  type ConnectorAuthConfig,
  type ConnectorRecord,
  type GoogleSheetPreview,
  type GoogleSpreadsheetFile,
  type GoogleSheetTab,
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
      spreadsheet_id: cfg.spreadsheet_id ?? "",
      sheet_name: cfg.sheet_name ?? "",
      key_column: cfg.key_column ?? "",
      header_row: cfg.header_row ?? 1,
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
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [keyColumn, setKeyColumn] = useState("");
  const [headerRow, setHeaderRow] = useState("1");
  const [googleFiles, setGoogleFiles] = useState<GoogleSpreadsheetFile[]>([]);
  const [googleSheets, setGoogleSheets] = useState<GoogleSheetTab[]>([]);
  const [sheetPreview, setSheetPreview] = useState<GoogleSheetPreview | null>(null);

  const isSql = connector?.connector_type === "sql";
  const isStorage = connector?.connector_type === "storage";
  const isGoogleSheets = connector?.connector_type === "google_sheets";

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
      } else if (conn.connector_type === "google_sheets") {
        setAuthType("oauth_authorization_code");
        setSpreadsheetId(cfg.spreadsheet_id ?? "");
        setSheetName(cfg.sheet_name ?? "");
        setKeyColumn(cfg.key_column ?? "");
        setHeaderRow(String(cfg.header_row ?? 1));
        setConnectionScope(cfg.connection_scope === "user" ? "user" : "app");
        setActions([]);
        try {
          const status = await connectorsApi.getOAuthConnection(connectorId);
          setHasConnection(Boolean(status.connected));
        } catch {
          setHasConnection(false);
        }
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
            setHasConnection(Boolean(status.connected));
          } catch {
            setHasConnection(false);
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
      } else if (isGoogleSheets) {
        authentication_type = "oauth_authorization_code";
        base_url = "";
        if (
          sheetPreview &&
          sheetPreview.columns.length > 0 &&
          keyColumn.trim() &&
          !sheetPreview.columns.some(
            (column) =>
              column.trim().toLowerCase() === keyColumn.trim().toLowerCase(),
          )
        ) {
          setError("Key column must match a preview header column.");
          setSaving(false);
          return;
        }
        auth_config = {
          type: "oauth_authorization_code",
          connection_scope: connectionScope,
          spreadsheet_id: spreadsheetId.trim(),
          sheet_name: sheetName.trim(),
          key_column: keyColumn.trim(),
          header_row: parseInt(headerRow, 10) || 1,
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

  const handleLoadGoogleFiles = async () => {
    if (!connectorId) return;
    try {
      const files = await connectorsApi.listGoogleFiles(connectorId);
      setGoogleFiles(files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list spreadsheets");
    }
  };

  const handleLoadGoogleSheets = async (fileId?: string) => {
    if (!connectorId) return;
    try {
      const id = fileId ?? spreadsheetId;
      const sheets = await connectorsApi.listGoogleSheets(connectorId, id);
      setGoogleSheets(sheets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list sheets");
    }
  };

  const handlePreviewSheet = async () => {
    if (!connectorId) return;
    try {
      const preview = await connectorsApi.previewGoogleSheet(connectorId, sheetName);
      setSheetPreview(preview);
      if (
        !keyColumn.trim() &&
        preview.columns.length > 0
      ) {
        setKeyColumn(String(preview.columns[0] ?? ""));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview sheet");
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
                : isGoogleSheets
                  ? "Google Sheets"
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
        ) : isGoogleSheets ? (
          <>
            <div>
              <label className={styles.fieldLabel}>Google account</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleConnectOAuth()}
                  disabled={oauthConnecting}
                >
                  {oauthConnecting ? "Starting…" : hasConnection ? "Reconnect Google" : "Connect Google"}
                </Button>
                <span style={{ fontSize: 12, color: "var(--color-text-muted, #666)" }}>
                  {hasConnection ? "Connected" : "Connect to browse spreadsheets in Drive"}
                </span>
              </div>
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="gs-spreadsheet-id">
                Spreadsheet ID
              </label>
              <input
                id="gs-spreadsheet-id"
                className={styles.fieldInput}
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
              />
              {spreadsheetId.trim() ? (
                <p style={{ marginTop: 6, fontSize: 12 }}>
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId.trim())}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open spreadsheet in Google Sheets
                  </a>
                </p>
              ) : null}
            </div>
            {hasConnection ? (
              <div>
                <Button variant="secondary" size="sm" onClick={() => void handleLoadGoogleFiles()}>
                  Browse Drive spreadsheets
                </Button>
                {googleFiles.length > 0 ? (
                  <select
                    className={styles.fieldSelect}
                    style={{ marginTop: 8, width: "100%" }}
                    value={spreadsheetId}
                    onChange={(e) => {
                      setSpreadsheetId(e.target.value);
                      void handleLoadGoogleSheets(e.target.value);
                    }}
                  >
                    <option value="">Select spreadsheet…</option>
                    {googleFiles.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ) : null}
            <div>
              <label className={styles.fieldLabel} htmlFor="gs-sheet-name">
                Sheet name
              </label>
              <input
                id="gs-sheet-name"
                className={styles.fieldInput}
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                list="gs-sheet-options"
              />
              {googleSheets.length > 0 ? (
                <datalist id="gs-sheet-options">
                  {googleSheets.map((s) => (
                    <option key={s.title} value={s.title} />
                  ))}
                </datalist>
              ) : null}
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="gs-key-column">
                Key column
              </label>
              {sheetPreview && sheetPreview.columns.length > 0 ? (
                <select
                  id="gs-key-column"
                  className={styles.fieldSelect}
                  value={keyColumn}
                  onChange={(e) => setKeyColumn(e.target.value)}
                  data-testid="gs-key-column-select"
                >
                  <option value="">Select key column…</option>
                  {sheetPreview.columns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="gs-key-column"
                  className={styles.fieldInput}
                  value={keyColumn}
                  onChange={(e) => setKeyColumn(e.target.value)}
                  placeholder="Id"
                />
              )}
              {sheetPreview &&
              keyColumn.trim() &&
              sheetPreview.columns.length > 0 &&
              !sheetPreview.columns.some(
                (column) =>
                  column.trim().toLowerCase() === keyColumn.trim().toLowerCase(),
              ) ? (
                <p className={styles.error} role="alert" style={{ marginTop: 6, fontSize: 12 }}>
                  Key column must match a preview header.
                </p>
              ) : null}
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="gs-header-row">
                Header row
              </label>
              <input
                id="gs-header-row"
                className={styles.fieldInput}
                type="number"
                min={1}
                value={headerRow}
                onChange={(e) => setHeaderRow(e.target.value)}
              />
            </div>
            {hasConnection && sheetName ? (
              <div>
                <Button variant="secondary" size="sm" onClick={() => void handlePreviewSheet()}>
                  Preview columns
                </Button>
                {sheetPreview ? (
                  <div style={{ marginTop: 8 }} data-testid="gs-sheet-preview">
                    <p style={{ fontSize: 12, margin: "0 0 8px" }}>
                      Columns: {sheetPreview.columns.join(", ") || "(none)"}
                    </p>
                    {sheetPreview.rows.length > 0 ? (
                      <div style={{ overflowX: "auto" }}>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: 11,
                          }}
                        >
                          <thead>
                            <tr>
                              {sheetPreview.columns.map((column) => (
                                <th
                                  key={column}
                                  style={{
                                    textAlign: "left",
                                    padding: "4px 6px",
                                    borderBottom: "1px solid #ddd",
                                    background: "#f5f5f5",
                                  }}
                                >
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sheetPreview.rows.map((row, rowIndex) => (
                              <tr key={`preview-row-${rowIndex}`}>
                                {sheetPreview.columns.map((_, colIndex) => (
                                  <td
                                    key={`preview-cell-${rowIndex}-${colIndex}`}
                                    style={{
                                      padding: "4px 6px",
                                      borderBottom: "1px solid #eee",
                                    }}
                                  >
                                    {String(row[colIndex] ?? "")}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ fontSize: 12, color: "#666" }}>No sample rows.</p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
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

      {!isStorage && !isGoogleSheets ? (
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
      ) : isGoogleSheets ? (
        <div className={styles.empty}>
          Google Sheets connectors bind Gallery/Form/DataTable to live spreadsheet rows. Connect Google,
          pick a spreadsheet and sheet, then bind controls to <code>{connector.name}</code> in Studio.
        </div>
      ) : (
        <div className={styles.empty}>
          Storage connectors list objects from the bucket (optional prefix). Bind Gallery Items to{" "}
          <code>{connector.name}</code>.
        </div>
      )}
    </>
  );
}
