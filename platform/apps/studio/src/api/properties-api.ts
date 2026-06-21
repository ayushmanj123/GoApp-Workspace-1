import { apiClient } from "./metadata-client";

export interface UpdatePropertiesPayload {
  properties: Record<string, unknown>;
}

export const propertiesApi = {
  update: (controlId: string, payload: UpdatePropertiesPayload) =>
    apiClient.put<void>(`/controls/${controlId}/properties`, payload),
};
