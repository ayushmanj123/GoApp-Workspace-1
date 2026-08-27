import { useState } from "react";
import {
  connectorsApi,
  type AuthenticationType,
  type ConnectorAuthConfig,
  type ConnectorType,
} from "../../../api/connectors-api";
import shellStyles from "../../preview/RuntimePreviewModal.module.css";
import modalStyles from "../../layout/InsertComponentModal.module.css";

interface CreateConnectorModalProps {
  open: boolean;
  applicationId: string;
  onClose: () => void;
  onCreated: (connectorId: string) => void;
}

export function CreateConnectorModal({
  open,
  applicationId,
  onClose,
  onCreated,
}: CreateConnectorModalProps) {
  const [connectorType, setConnectorType] = useState<ConnectorType>("rest");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authType, setAuthType] = useState<AuthenticationType>("none");
  const [headerName, setHeaderName] = useState("X-Api-Key");
  const [headerValue, setHeaderValue] = useState("");
  const [connectionString, setConnectionString] = useState("");
  const [table, setTable] = useState("");
  const [primaryKey, setPrimaryKey] = useState("id");
  const [tokenUrl, setTokenUrl] = useState("");
  const [authorizationUrl, setAuthorizationUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [scope, setScope] = useState("");
  const [connectionScope, setConnectionScope] = useState<"app" | "user">("app");
  const [endpoint, setEndpoint] = useState("localhost:9000");
  const [bucket, setBucket] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [useSsl, setUseSsl] = useState(false);
  const [prefix, setPrefix] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [keyColumn, setKeyColumn] = useState("Id");
  const [headerRow, setHeaderRow] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setConnectorType("rest");
    setName("");
    setBaseUrl("");
    setAuthType("none");
    setHeaderName("X-Api-Key");
    setHeaderValue("");
    setConnectionString("");
    setTable("");
    setPrimaryKey("id");
    setTokenUrl("");
    setAuthorizationUrl("");
    setClientId("");
    setClientSecret("");
    setScope("");
    setConnectionScope("app");
    setEndpoint("localhost:9000");
    setBucket("");
    setAccessKeyId("");
    setSecretAccessKey("");
    setUseSsl(false);
    setPrefix("");
    setSpreadsheetId("");
    setSheetName("");
    setKeyColumn("Id");
    setHeaderRow("1");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let authentication_type: AuthenticationType = authType;
      let auth_config: ConnectorAuthConfig = { type: "none" };
      let connector_type: ConnectorType = "rest";
      let base_url = baseUrl.trim();

      if (connectorType === "sql") {
        connector_type = "sql";
        authentication_type = "connection_string";
        base_url = "";
        auth_config = {
          type: "connection_string",
          connection_string: connectionString.trim(),
          ...(table.trim() ? { table: table.trim() } : {}),
          ...(primaryKey.trim() ? { primary_key: primaryKey.trim() } : {}),
        };
      } else if (connectorType === "storage") {
        connector_type = "storage";
        authentication_type = "s3";
        base_url = "";
        auth_config = {
          type: "s3",
          endpoint: endpoint.trim(),
          bucket: bucket.trim(),
          access_key_id: accessKeyId.trim(),
          secret_access_key: secretAccessKey.trim(),
          use_ssl: useSsl,
          ...(prefix.trim() ? { prefix: prefix.trim() } : {}),
        };
      } else if (connectorType === "google_sheets") {
        connector_type = "google_sheets";
        authentication_type = "oauth_authorization_code";
        base_url = "";
        auth_config = {
          type: "oauth_authorization_code",
          connection_scope: connectionScope,
          spreadsheet_id: spreadsheetId.trim(),
          sheet_name: sheetName.trim(),
          key_column: keyColumn.trim(),
          header_row: parseInt(headerRow, 10) || 1,
        };
      } else if (authType === "header") {
        auth_config = {
          type: "header",
          header_name: headerName.trim() || "X-Api-Key",
          header_value: headerValue,
        };
      } else if (authType === "oauth_client_credentials") {
        authentication_type = "oauth_client_credentials";
        auth_config = {
          type: "oauth_client_credentials",
          token_url: tokenUrl.trim(),
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          ...(scope.trim() ? { scope: scope.trim() } : {}),
        };
      } else if (authType === "oauth_authorization_code") {
        authentication_type = "oauth_authorization_code";
        auth_config = {
          type: "oauth_authorization_code",
          authorization_url: authorizationUrl.trim(),
          token_url: tokenUrl.trim(),
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          connection_scope: connectionScope,
          ...(scope.trim() ? { scope: scope.trim() } : {}),
        };
      }

      const connector = await connectorsApi.create(applicationId, {
        name: name.trim(),
        connector_type,
        authentication_type,
        base_url,
        auth_config,
      });
      reset();
      onClose();
      onCreated(connector.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create connector");
    } finally {
      setSaving(false);
    }
  };

  const canSubmit =
    !!name.trim() &&
    (connectorType === "sql"
      ? !!connectionString.trim()
      : connectorType === "google_sheets"
        ? !!sheetName.trim()
        : connectorType === "storage"
        ? !!endpoint.trim() &&
          !!bucket.trim() &&
          !!accessKeyId.trim() &&
          !!secretAccessKey.trim()
        : authType === "header"
          ? !!headerValue.trim()
          : authType === "oauth_client_credentials"
            ? !!tokenUrl.trim() && !!clientId.trim() && !!clientSecret.trim()
            : authType === "oauth_authorization_code"
              ? !!authorizationUrl.trim() &&
                !!tokenUrl.trim() &&
                !!clientId.trim() &&
                !!clientSecret.trim()
              : true);

  return (
    <div className={shellStyles.overlay} onMouseDown={onClose}>
      <div
        className={`${shellStyles.dialog} ${modalStyles.dialog}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create Connector"
      >
        <header className={shellStyles.header}>
          <div className={shellStyles.title}>New Connector</div>
        </header>
        <form className={modalStyles.body} onSubmit={(e) => void handleSubmit(e)}>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            Type
            <select
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
              value={connectorType}
              onChange={(e) => {
                const next = e.target.value as ConnectorType;
                setConnectorType(next);
                if (next === "google_sheets") {
                  setConnectionScope("user");
                }
              }}
              data-testid="connector-type"
            >
              <option value="rest">REST</option>
              <option value="sql">SQL (Postgres)</option>
              <option value="storage">Storage (S3 / MinIO)</option>
              <option value="google_sheets">Google Sheets (Excel Apps)</option>
            </select>
          </label>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            Name
            <input
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                connectorType === "sql"
                  ? "OrdersDb"
                  : connectorType === "storage"
                    ? "DocsBucket"
                    : connectorType === "google_sheets"
                      ? "Customers"
                      : "Weather"
              }
              autoFocus
              required
              data-testid="connector-name-input"
            />
          </label>

          {connectorType === "sql" ? (
            <>
              <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                Connection string
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="postgres://user:pass@host:5432/db?sslmode=disable"
                  required
                  data-testid="connector-connection-string"
                />
              </label>
              <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                Table / view (optional if using a named list query)
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                  value={table}
                  onChange={(e) => setTable(e.target.value)}
                  placeholder="public.orders"
                  data-testid="connector-table"
                />
              </label>
              <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                Primary key (optional)
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                  value={primaryKey}
                  onChange={(e) => setPrimaryKey(e.target.value)}
                  placeholder="id"
                  data-testid="connector-primary-key"
                />
              </label>
            </>
          ) : connectorType === "google_sheets" ? (
            <>
              <p style={{ fontSize: 11, color: "#666", marginTop: 0 }}>
                OAuth credentials are configured on the server. After create, open the connector and click Connect to authorize Google Drive.
              </p>
              <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                Spreadsheet ID (optional — pick after connect)
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  placeholder="Google Sheets file ID"
                />
              </label>
              <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                Sheet name
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  placeholder="Sheet1"
                  required
                />
              </label>
              <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                Key column
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                  value={keyColumn}
                  onChange={(e) => setKeyColumn(e.target.value)}
                  placeholder="Id"
                />
              </label>
              <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                Header row
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                  value={headerRow}
                  onChange={(e) => setHeaderRow(e.target.value)}
                  type="number"
                  min={1}
                />
              </label>
              <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                Connection scope
                <select
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                  value={connectionScope}
                  onChange={(e) =>
                    setConnectionScope(e.target.value === "user" ? "user" : "app")
                  }
                >
                  <option value="user">Per-user (recommended for Google Drive)</option>
                  <option value="app">App (shared account)</option>
                </select>
              </label>
            </>
          ) : connectorType === "storage" ? (
            <>
              <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                Endpoint
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="localhost:9000"
                  required
                />
              </label>
              <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                Bucket
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value)}
                  required
                />
              </label>
              <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                Access key ID
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  required
                />
              </label>
              <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                Secret access key
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </label>
              <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                Prefix (optional)
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 12 }}>
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
              <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                Base URL
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com"
                  data-testid="connector-base-url-input"
                />
              </label>
              <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                Authentication
                <select
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value as AuthenticationType)}
                  data-testid="connector-auth-type"
                >
                  <option value="none">None</option>
                  <option value="header">Static header</option>
                  <option value="oauth_client_credentials">OAuth client credentials</option>
                  <option value="oauth_authorization_code">OAuth authorization code</option>
                </select>
              </label>
              {authType === "header" ? (
                <>
                  <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                    Header name
                    <input
                      style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                      value={headerName}
                      onChange={(e) => setHeaderName(e.target.value)}
                    />
                  </label>
                  <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                    API key / header value
                    <input
                      style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                      value={headerValue}
                      onChange={(e) => setHeaderValue(e.target.value)}
                      type="password"
                      autoComplete="new-password"
                      required
                      data-testid="connector-header-value"
                    />
                  </label>
                </>
              ) : null}
              {authType === "oauth_client_credentials" ||
              authType === "oauth_authorization_code" ? (
                <>
                  {authType === "oauth_authorization_code" ? (
                    <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                      Authorization URL
                      <input
                        style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                        value={authorizationUrl}
                        onChange={(e) => setAuthorizationUrl(e.target.value)}
                        placeholder="https://idp.example.com/oauth/authorize"
                        required
                      />
                    </label>
                  ) : null}
                  <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                    Token URL
                    <input
                      style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                      value={tokenUrl}
                      onChange={(e) => setTokenUrl(e.target.value)}
                      placeholder="https://idp.example.com/oauth/token"
                      required
                    />
                  </label>
                  <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                    Client ID
                    <input
                      style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      required
                    />
                  </label>
                  <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                    Client secret
                    <input
                      style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      type="password"
                      autoComplete="new-password"
                      required
                    />
                  </label>
                  <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                    Scope (optional)
                    <input
                      style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                      value={scope}
                      onChange={(e) => setScope(e.target.value)}
                    />
                  </label>
                  {authType === "oauth_authorization_code" ? (
                    <>
                      <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                        Connection scope
                        <select
                          style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                          value={connectionScope}
                          onChange={(e) =>
                            setConnectionScope(e.target.value === "user" ? "user" : "app")
                          }
                          data-testid="connector-create-connection-scope"
                        >
                          <option value="app">App (shared — Connect once in Studio)</option>
                          <option value="user">Per-user (each runtime user Connects)</option>
                        </select>
                      </label>
                      <p style={{ fontSize: 11, color: "#666", marginTop: 0 }}>
                        {connectionScope === "user"
                          ? "After create, runtime users will be prompted to Connect. You can also Connect as yourself on the detail page for testing."
                          : "After create, open the connector and click Connect to authorize the app-level account."}
                      </p>
                    </>
                  ) : null}
                </>
              ) : null}
            </>
          )}

          {error ? (
            <p className={modalStyles.empty} style={{ color: "var(--color-danger)" }}>
              {error}
            </p>
          ) : null}
          <div className={modalStyles.footer}>
            <button
              type="button"
              className={modalStyles.cancelBtn}
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={modalStyles.itemBtn}
              style={{ width: "auto", marginLeft: 8 }}
              disabled={saving || !canSubmit}
              data-testid="connector-create-submit"
            >
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
