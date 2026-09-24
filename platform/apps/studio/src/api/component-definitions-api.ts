import { apiClient, PagedData } from "./metadata-client";

export type ComponentPropertyDirection = "input" | "output" | "action";
export type ComponentPropertyDataType =
  | "text"
  | "number"
  | "boolean"
  | "color"
  | "record"
  | "table";

export interface ComponentCustomProperty {
  name: string;
  direction: ComponentPropertyDirection;
  dataType: ComponentPropertyDataType;
  formula?: string;
}

export interface ComponentDefinitionJson {
  properties?: ComponentCustomProperty[];
  controls: ComponentSnapshotControl[];
}

export interface ComponentDefinitionRecord {
  id: string;
  tenant_id: string;
  application_id: string;
  name: string;
  definition_json: ComponentDefinitionJson;
  CreatedOn?: string;
  ModifiedOn?: string;
}

export interface ComponentSnapshotControl {
  local_id: string;
  parent_local_id?: string | null;
  control_type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  properties?: Record<string, unknown>;
}

export interface CreateComponentDefinitionPayload {
  name: string;
  definition: ComponentDefinitionJson;
}

export interface UpdateComponentDefinitionPayload {
  name?: string;
  definition: ComponentDefinitionJson;
}

export const componentDefinitionsApi = {
  list: (applicationId: string, limit = 100, offset = 0) =>
    apiClient.get<PagedData<ComponentDefinitionRecord>>(
      `/applications/${applicationId}/component-definitions?limit=${limit}&offset=${offset}`,
    ),

  get: (definitionId: string) =>
    apiClient.get<ComponentDefinitionRecord>(`/component-definitions/${definitionId}`),

  create: (applicationId: string, payload: CreateComponentDefinitionPayload) =>
    apiClient.post<ComponentDefinitionRecord>(
      `/applications/${applicationId}/component-definitions`,
      payload,
    ),

  update: (definitionId: string, payload: UpdateComponentDefinitionPayload) =>
    apiClient.put<ComponentDefinitionRecord>(
      `/component-definitions/${definitionId}`,
      payload,
    ),
};
