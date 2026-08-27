import {
  connectorsApi,
  type ConnectorAuthConfig,
  type ConnectorRecord,
  type GoogleSheetPreview,
} from "../api/connectors-api";

export function parseConnectorAuthConfig(
  authConfig: ConnectorRecord["auth_config"],
): ConnectorAuthConfig {
  if (!authConfig || typeof authConfig !== "object") {
    return {};
  }
  return authConfig as ConnectorAuthConfig;
}

export function isGoogleSheetsConnector(connector: ConnectorRecord): boolean {
  return connector.connector_type === "google_sheets";
}

export function googleSheetsConnectorReady(connector: ConnectorRecord): {
  ready: boolean;
  reason?: string;
} {
  if (!isGoogleSheetsConnector(connector)) {
    return { ready: false, reason: "Not a Google Sheets connector" };
  }
  const cfg = parseConnectorAuthConfig(connector.auth_config);
  if (!String(cfg.spreadsheet_id ?? "").trim()) {
    return { ready: false, reason: "Set spreadsheet ID and Connect Google first" };
  }
  if (!String(cfg.sheet_name ?? "").trim()) {
    return { ready: false, reason: "Set sheet name first" };
  }
  return { ready: true };
}

export function normalizeSheetColumns(columns: string[]): string[] {
  return columns
    .map((column) => String(column ?? "").trim())
    .filter((column) => column.length > 0);
}

/** Fetch header columns (+ optional sample rows) for a google_sheets connector. */
export async function fetchGoogleSheetPreview(
  connector: ConnectorRecord,
  limit = 5,
): Promise<GoogleSheetPreview> {
  const status = googleSheetsConnectorReady(connector);
  if (!status.ready) {
    throw new Error(status.reason ?? "Google Sheets connector is not ready");
  }
  const cfg = parseConnectorAuthConfig(connector.auth_config);
  const preview = await connectorsApi.previewGoogleSheet(
    connector.id,
    String(cfg.sheet_name ?? "").trim() || undefined,
    limit,
  );
  return {
    columns: normalizeSheetColumns(preview.columns ?? []),
    rows: preview.rows ?? [],
  };
}

export async function fetchGoogleSheetColumns(
  connector: ConnectorRecord,
): Promise<string[]> {
  const preview = await fetchGoogleSheetPreview(connector, 1);
  return preview.columns;
}
