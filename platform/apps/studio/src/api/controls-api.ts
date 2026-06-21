import { apiClient, PagedData } from "./metadata-client";

export interface Control {
  id: string;
  tenant_id: string;
  screen_id: string;
  parent_control_id: string | null;
  control_type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  properties: Record<string, unknown> | null;
  deleted_at: string | null;
  CreatedOn: string;
  ModifiedOn: string;
}

export interface UpdateControlPayload {
  name: string;
  control_type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  parent_control_id?: string | null;
}

export const controlsApi = {
  list: (screenId: string, limit = 200, offset = 0) =>
    apiClient.get<PagedData<Control>>(
      `/screens/${screenId}/controls?limit=${limit}&offset=${offset}`,
    ),

  update: (controlId: string, payload: UpdateControlPayload) =>
    apiClient.put<Control>(`/controls/${controlId}`, payload),
};
