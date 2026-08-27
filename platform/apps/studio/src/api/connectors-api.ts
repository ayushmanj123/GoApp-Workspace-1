import { apiClient, PagedData } from "./metadata-client";

export type ConnectorType = "rest" | "sql" | "storage" | "google_sheets";
export type AuthenticationType =
  | "none"
  | "header"
  | "connection_string"
  | "oauth_client_credentials"
  | "oauth_authorization_code"
  | "s3";
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export interface ConnectorAuthConfig {
  type?: AuthenticationType;
  header_name?: string;
  header_value?: string;
  connection_string?: string;
  client_secret?: string;
  secret_access_key?: string;
  secret_id?: string;
  refresh_secret_id?: string;
  table?: string;
  primary_key?: string;
  token_url?: string;
  authorization_url?: string;
  client_id?: string;
  scope?: string;
  connection_scope?: "app" | "user";
  endpoint?: string;
  bucket?: string;
  access_key_id?: string;
  use_ssl?: boolean;
  prefix?: string;
  spreadsheet_id?: string;
  sheet_name?: string;
  header_row?: number;
  key_column?: string;
}

export interface ConnectorRecord {
  id: string;
  tenant_id: string;
  application_id: string;
  connector_type: ConnectorType;
  name: string;
  authentication_type: AuthenticationType;
  base_url: string;
  auth_config?: ConnectorAuthConfig | Record<string, unknown> | null;
  has_secret?: boolean;
  has_connection?: boolean;
  created_on?: string;
  modified_on?: string;
  CreatedOn?: string;
  ModifiedOn?: string;
}

export interface ConnectorActionRecord {
  id: string;
  tenant_id: string;
  connector_id: string;
  action_name: string;
  http_method: HttpMethod;
  endpoint: string;
  created_on?: string;
  modified_on?: string;
}

export interface CreateConnectorPayload {
  name: string;
  connector_type: ConnectorType;
  authentication_type: AuthenticationType;
  base_url?: string;
  auth_config?: ConnectorAuthConfig;
}

export interface UpdateConnectorPayload {
  name?: string;
  authentication_type?: AuthenticationType;
  base_url?: string;
  auth_config?: ConnectorAuthConfig;
}

export interface CreateConnectorActionPayload {
  action_name: string;
  http_method: HttpMethod;
  endpoint: string;
}

export interface UpdateConnectorActionPayload {
  action_name?: string;
  http_method?: HttpMethod;
  endpoint?: string;
}

export interface GoogleSpreadsheetFile {
  id: string;
  name: string;
}

export interface GoogleSheetTab {
  title: string;
  index: number;
}

export interface GoogleSheetPreview {
  columns: string[];
  rows: unknown[][];
}

export const connectorsApi = {
  list: (applicationId: string, limit = 100, offset = 0) =>
    apiClient.get<PagedData<ConnectorRecord>>(
      `/applications/${applicationId}/connectors?limit=${limit}&offset=${offset}`,
    ),

  get: (id: string) => apiClient.get<ConnectorRecord>(`/connectors/${id}`),

  create: (applicationId: string, payload: CreateConnectorPayload) =>
    apiClient.post<ConnectorRecord>(
      `/applications/${applicationId}/connectors`,
      payload,
    ),

  update: (id: string, payload: UpdateConnectorPayload) =>
    apiClient.put<ConnectorRecord>(`/connectors/${id}`, payload),

  remove: (id: string) => apiClient.delete(`/connectors/${id}`),

  listActions: (connectorId: string, limit = 100, offset = 0) =>
    apiClient.get<PagedData<ConnectorActionRecord>>(
      `/connectors/${connectorId}/actions?limit=${limit}&offset=${offset}`,
    ),

  createAction: (connectorId: string, payload: CreateConnectorActionPayload) =>
    apiClient.post<ConnectorActionRecord>(
      `/connectors/${connectorId}/actions`,
      payload,
    ),

  updateAction: (id: string, payload: UpdateConnectorActionPayload) =>
    apiClient.put<ConnectorActionRecord>(`/connector-actions/${id}`, payload),

  removeAction: (id: string) => apiClient.delete(`/connector-actions/${id}`),

  startOAuth: (connectorId: string, returnTo: "studio" | "runtime" = "studio") =>
    apiClient.post<{ authorize_url: string; state: string }>(
      `/connectors/${connectorId}/oauth/start`,
      { return_to: returnTo },
    ),

  getOAuthConnection: (connectorId: string) =>
    apiClient.get<{ connected: boolean; connection_scope: string }>(
      `/connectors/${connectorId}/oauth/connection`,
    ),

  disconnectOAuth: (connectorId: string) =>
    apiClient.delete(`/connectors/${connectorId}/oauth/connection`),

  listGoogleFiles: (connectorId: string, q = "", limit = 50) =>
    apiClient.get<GoogleSpreadsheetFile[]>(
      `/connectors/${connectorId}/google/files?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),

  listGoogleSheets: (connectorId: string, spreadsheetId?: string) =>
    apiClient.get<GoogleSheetTab[]>(
      `/connectors/${connectorId}/google/sheets${spreadsheetId ? `?spreadsheet_id=${encodeURIComponent(spreadsheetId)}` : ""}`,
    ),

  previewGoogleSheet: (connectorId: string, sheet?: string, limit = 5) =>
    apiClient.get<GoogleSheetPreview>(
      `/connectors/${connectorId}/google/preview?limit=${limit}${sheet ? `&sheet=${encodeURIComponent(sheet)}` : ""}`,
    ),
};
