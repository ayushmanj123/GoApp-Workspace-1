import { apiClient, PagedData } from "./metadata-client";

export type EntityFieldType = "text" | "number" | "boolean" | "date" | "lookup";

export interface EntityRecord {
  id: string;
  tenant_id: string;
  application_id: string;
  name: string;
  display_name: string;
  CreatedOn?: string;
  ModifiedOn?: string;
  created_on?: string;
  modified_on?: string;
  CreatedBy?: string | null;
  created_by?: string | null;
}

export interface EntityFieldRecord {
  id: string;
  tenant_id: string;
  entity_id: string;
  name: string;
  display_name: string;
  field_type: EntityFieldType;
  is_required?: boolean;
  related_entity_id?: string | null;
  CreatedOn?: string;
  ModifiedOn?: string;
  created_on?: string;
  modified_on?: string;
  CreatedBy?: string | null;
  created_by?: string | null;
}

export interface CreateEntityPayload {
  name: string;
  display_name: string;
}

export interface UpdateEntityPayload {
  name?: string;
  display_name?: string;
}

export interface CreateEntityFieldPayload {
  name: string;
  display_name: string;
  field_type: EntityFieldType;
  related_entity_id?: string;
}

export interface UpdateEntityFieldPayload {
  name?: string;
  display_name?: string;
  field_type?: EntityFieldType;
  // Pass an empty string to clear an existing relationship.
  related_entity_id?: string;
}

export const entitiesApi = {
  list: (applicationId: string, limit = 100, offset = 0) =>
    apiClient.get<PagedData<EntityRecord>>(
      `/applications/${applicationId}/entities?limit=${limit}&offset=${offset}`,
    ),

  create: (applicationId: string, payload: CreateEntityPayload) =>
    apiClient.post<EntityRecord>(`/applications/${applicationId}/entities`, payload),

  update: (entityId: string, payload: UpdateEntityPayload) =>
    apiClient.put<EntityRecord>(`/entities/${entityId}`, payload),

  listFields: (entityId: string, limit = 100, offset = 0) =>
    apiClient.get<PagedData<EntityFieldRecord>>(
      `/entities/${entityId}/fields?limit=${limit}&offset=${offset}`,
    ),

  createField: (entityId: string, payload: CreateEntityFieldPayload) =>
    apiClient.post<EntityFieldRecord>(`/entities/${entityId}/fields`, payload),

  updateField: (fieldId: string, payload: UpdateEntityFieldPayload) =>
    apiClient.put<EntityFieldRecord>(`/entity-fields/${fieldId}`, payload),
};
