import { apiClient, PagedData } from "./metadata-client";

export type EnvironmentType = "development" | "test" | "production";

export interface EnvironmentRecord {
  id: string;
  tenant_id: string;
  application_id: string;
  name: string;
  environment_type: EnvironmentType;
  current_version_id: string | null;
  current_version?: string | null;
  created_on?: string;
  modified_on?: string;
}

export interface CreateEnvironmentPayload {
  name: string;
  environment_type: EnvironmentType;
}

export interface UpdateEnvironmentPayload {
  name?: string;
  environment_type?: EnvironmentType;
}

export interface PromoteEnvironmentPayload {
  version_id: string;
}

export const environmentsApi = {
  list: (applicationId: string) =>
    apiClient.get<PagedData<EnvironmentRecord>>(
      `/applications/${applicationId}/environments`,
    ),

  get: (applicationId: string, environmentId: string) =>
    apiClient.get<EnvironmentRecord>(
      `/applications/${applicationId}/environments/${environmentId}`,
    ),

  create: (applicationId: string, payload: CreateEnvironmentPayload) =>
    apiClient.post<EnvironmentRecord>(
      `/applications/${applicationId}/environments`,
      payload,
    ),

  update: (
    applicationId: string,
    environmentId: string,
    payload: UpdateEnvironmentPayload,
  ) =>
    apiClient.put<EnvironmentRecord>(
      `/applications/${applicationId}/environments/${environmentId}`,
      payload,
    ),

  remove: (applicationId: string, environmentId: string) =>
    apiClient.delete(
      `/applications/${applicationId}/environments/${environmentId}`,
    ),

  promote: (
    applicationId: string,
    environmentId: string,
    payload: PromoteEnvironmentPayload,
  ) =>
    apiClient.post<EnvironmentRecord>(
      `/applications/${applicationId}/environments/${environmentId}/promote`,
      payload,
    ),
};
