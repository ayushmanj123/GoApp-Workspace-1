import { apiClient, PagedData } from "./metadata-client";

export type ConnectorType = "rest" | "sql" | "storage";
export type AuthenticationType =
  | "none"
  | "header"
  | "connection_string"
  | "oauth_client_credentials"
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
  table?: string;
  primary_key?: string;
  token_url?: string;
  client_id?: string;
  scope?: string;
  endpoint?: string;
  bucket?: string;
  access_key_id?: string;
  use_ssl?: boolean;
  prefix?: string;
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
};
