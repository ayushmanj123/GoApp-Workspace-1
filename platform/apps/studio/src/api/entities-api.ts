import { apiClient, PagedData } from "./metadata-client";

export type EntityFieldType = "text" | "number" | "boolean" | "date";

export interface EntityRecord {
  id: string;
  tenant_id: string;
  application_id: string;
  name: string;
  display_name: string;
  CreatedOn?: string;
  ModifiedOn?: string;
}

export interface EntityFieldRecord {
  id: string;
  tenant_id: string;
  entity_id: string;
  name: string;
  display_name: string;
  field_type: EntityFieldType;
  CreatedOn?: string;
  ModifiedOn?: string;
}

export interface CreateEntityPayload {
  name: string;
  display_name: string;
}

export interface CreateEntityFieldPayload {
  name: string;
  display_name: string;
  field_type: EntityFieldType;
}

export const entitiesApi = {
  list: (applicationId: string, limit = 100, offset = 0) =>
    apiClient.get<PagedData<EntityRecord>>(
      `/applications/${applicationId}/entities?limit=${limit}&offset=${offset}`,
    ),

  create: (applicationId: string, payload: CreateEntityPayload) =>
    apiClient.post<EntityRecord>(`/applications/${applicationId}/entities`, payload),

  listFields: (entityId: string, limit = 100, offset = 0) =>
    apiClient.get<PagedData<EntityFieldRecord>>(
      `/entities/${entityId}/fields?limit=${limit}&offset=${offset}`,
    ),

  createField: (entityId: string, payload: CreateEntityFieldPayload) =>
    apiClient.post<EntityFieldRecord>(`/entities/${entityId}/fields`, payload),
};
