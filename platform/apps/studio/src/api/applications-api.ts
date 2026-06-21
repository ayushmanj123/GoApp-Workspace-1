import { apiClient, PagedData } from './metadata-client';

export interface Application {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  current_version_id: string | null;
  deleted_at: string | null;
  CreatedOn: string;
  ModifiedOn: string;
}

export interface CreateApplicationPayload {
  name: string;
  description: string;
}

export interface UpdateApplicationPayload {
  name?: string;
  description?: string;
  status?: 'draft' | 'published' | 'archived';
}

export const applicationsApi = {
  list: (limit = 100, offset = 0) =>
    apiClient.get<PagedData<Application>>(
      `/applications?limit=${limit}&offset=${offset}`,
    ),

  get: (id: string) =>
    apiClient.get<Application>(`/applications/${id}`),

  create: (payload: CreateApplicationPayload) =>
    apiClient.post<Application>('/applications', payload),

  update: (id: string, payload: UpdateApplicationPayload) =>
    apiClient.put<Application>(`/applications/${id}`, payload),

  delete: (id: string) =>
    apiClient.delete(`/applications/${id}`),
};
