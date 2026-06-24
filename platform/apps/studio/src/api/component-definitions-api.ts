import { apiClient, PagedData } from "./metadata-client";

export interface ComponentDefinitionRecord {
  id: string;
  tenant_id: string;
  application_id: string;
  name: string;
  definition_json: {
    controls: ComponentSnapshotControl[];
  };
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
  definition: {
    controls: ComponentSnapshotControl[];
  };
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
};
