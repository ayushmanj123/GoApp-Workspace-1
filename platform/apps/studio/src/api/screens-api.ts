import { apiClient, PagedData } from './metadata-client';

export interface Screen {
  id: string;
  tenant_id: string;
  application_id: string;
  name: string;
  display_order: number;
  layout_type: string;
  on_visible?: string | null;
  deleted_at: string | null;
  CreatedOn: string;
  ModifiedOn: string;
}

export interface CreateScreenPayload {
  name: string;
  display_order: number;
  layout_type: string;
}

export interface UpdateScreenPayload {
  name?: string;
  display_order?: number;
  layout_type?: string;
  on_visible?: string;
}

export const screensApi = {
  list: (applicationId: string, limit = 100, offset = 0) =>
    apiClient.get<PagedData<Screen>>(
      `/applications/${applicationId}/screens?limit=${limit}&offset=${offset}`,
    ),

  create: (applicationId: string, payload: CreateScreenPayload) =>
    apiClient.post<Screen>(`/applications/${applicationId}/screens`, payload),

  update: (screenId: string, payload: UpdateScreenPayload) =>
    apiClient.put<Screen>(`/screens/${screenId}`, payload),

  delete: (screenId: string) =>
    apiClient.delete(`/screens/${screenId}`),
};
