import { apiClient, PagedData } from "./metadata-client";

export type EntityFieldType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "lookup"
  | "multiline"
  | "email"
  | "phone"
  | "url"
  | "integer"
  | "decimal"
  | "currency"
  | "datetime"
  | "choice"
  | "choices";

export const ENTITY_FIELD_TYPES: EntityFieldType[] = [
  "text",
  "multiline",
  "email",
  "phone",
  "url",
  "number",
  "integer",
  "decimal",
  "currency",
  "boolean",
  "date",
  "datetime",
  "choice",
  "choices",
  "lookup",
];

export interface EntityRecord {
  id: string;
  tenant_id: string;
  application_id: string;
  name: string;
  display_name: string;
  plural_display_name?: string;
  description?: string;
  primary_field_id?: string | null;
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
  is_unique?: boolean;
  related_entity_id?: string | null;
  options_json?: string[] | string | null;
  options?: string[];
  config_json?: Record<string, unknown> | string | null;
  delete_behavior?: "restrict" | "clear" | "cascade";
  CreatedOn?: string;
  ModifiedOn?: string;
  created_on?: string;
  modified_on?: string;
  CreatedBy?: string | null;
  created_by?: string | null;
}

export interface EntityKeyRecord {
  id: string;
  tenant_id: string;
  entity_id: string;
  name: string;
  field_ids: string[] | string;
}

export interface EntityRelationshipRecord {
  id: string;
  tenant_id: string;
  name: string;
  relationship_type: string;
  left_entity_id: string;
  right_entity_id: string;
}

export interface CreateEntityPayload {
  name: string;
  display_name: string;
  plural_display_name?: string;
  description?: string;
  create_primary_name?: boolean;
}

export interface UpdateEntityPayload {
  name?: string;
  display_name?: string;
  plural_display_name?: string;
  description?: string;
  primary_field_id?: string;
}

export interface CreateEntityFieldPayload {
  name: string;
  display_name: string;
  field_type: EntityFieldType;
  is_required?: boolean;
  is_unique?: boolean;
  related_entity_id?: string;
  options?: string[];
  config_json?: Record<string, unknown>;
  delete_behavior?: "restrict" | "clear" | "cascade";
}

export interface UpdateEntityFieldPayload {
  name?: string;
  display_name?: string;
  field_type?: EntityFieldType;
  is_required?: boolean;
  is_unique?: boolean;
  related_entity_id?: string;
  options?: string[];
  config_json?: Record<string, unknown>;
  delete_behavior?: "restrict" | "clear" | "cascade";
}

/** Normalize options_json from API into a string array. */
export function fieldOptions(field: EntityFieldRecord): string[] {
  if (Array.isArray(field.options) && field.options.length) return field.options;
  const raw = field.options_json;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }
  return [];
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

  delete: (entityId: string) => apiClient.delete<void>(`/entities/${entityId}`),

  listDependents: (entityId: string) =>
    apiClient.get<PagedData<EntityFieldRecord>>(`/entities/${entityId}/dependents`),

  listFields: (entityId: string, limit = 100, offset = 0) =>
    apiClient.get<PagedData<EntityFieldRecord>>(
      `/entities/${entityId}/fields?limit=${limit}&offset=${offset}`,
    ),

  createField: (entityId: string, payload: CreateEntityFieldPayload) =>
    apiClient.post<EntityFieldRecord>(`/entities/${entityId}/fields`, payload),

  updateField: (fieldId: string, payload: UpdateEntityFieldPayload) =>
    apiClient.put<EntityFieldRecord>(`/entity-fields/${fieldId}`, payload),

  deleteField: (fieldId: string) => apiClient.delete<void>(`/entity-fields/${fieldId}`),

  listKeys: (entityId: string) =>
    apiClient.get<PagedData<EntityKeyRecord>>(`/entities/${entityId}/keys`),

  createKey: (entityId: string, payload: { name: string; field_ids: string[] }) =>
    apiClient.post<EntityKeyRecord>(`/entities/${entityId}/keys`, payload),

  deleteKey: (keyId: string) => apiClient.delete<void>(`/entity-keys/${keyId}`),

  listRelationships: (entityId: string) =>
    apiClient.get<PagedData<EntityRelationshipRecord>>(
      `/entities/${entityId}/relationships`,
    ),

  createRelationship: (payload: {
    name: string;
    left_entity_id: string;
    right_entity_id: string;
  }) => apiClient.post<EntityRelationshipRecord>(`/entity-relationships`, payload),

  deleteRelationship: (id: string) =>
    apiClient.delete<void>(`/entity-relationships/${id}`),
};
