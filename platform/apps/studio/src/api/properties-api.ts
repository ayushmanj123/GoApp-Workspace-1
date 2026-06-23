import { apiClient } from "./metadata-client";

export interface UpdatePropertiesPayload {
  properties: Record<string, unknown>;
}

export const propertiesApi = {
  get: (controlId: string) =>
    apiClient.get<Record<string, unknown>>(`/controls/${controlId}/properties`),

  update: (controlId: string, payload: UpdatePropertiesPayload) =>
    apiClient.put<void>(`/controls/${controlId}/properties`, payload),
};
