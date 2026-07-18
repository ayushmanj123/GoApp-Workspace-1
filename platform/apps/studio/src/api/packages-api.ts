import { apiClient, PagedData } from "./metadata-client";

export type PackageComponentType = "app" | "table";

export interface PackageRecord {
  id: string;
  tenant_id: string;
  name: string;
  display_name: string;
  description: string;
  version: string;
  managed: boolean;
  is_master: boolean;
  status: string;
  component_count: number;
  created_on?: string;
  modified_on?: string;
}

export interface PackageComponentRecord {
  id: string;
  package_id: string;
  component_type: PackageComponentType;
  component_id: string;
  name: string;
  display_name: string;
  added_on?: string;
  added_by?: string | null;
}

export interface CreatePackagePayload {
  name: string;
  display_name: string;
  description?: string;
}

export interface UpdatePackagePayload {
  name?: string;
  display_name?: string;
  description?: string;
  version?: string;
}

export interface AddPackageComponentPayload {
  component_type: PackageComponentType;
  component_id: string;
}

export const packagesApi = {
  list: (limit = 100, offset = 0) =>
    apiClient.get<PagedData<PackageRecord>>(
      `/packages?limit=${limit}&offset=${offset}`,
    ),

  get: (id: string) => apiClient.get<PackageRecord>(`/packages/${id}`),

  create: (payload: CreatePackagePayload) =>
    apiClient.post<PackageRecord>("/packages", payload),

  update: (id: string, payload: UpdatePackagePayload) =>
    apiClient.put<PackageRecord>(`/packages/${id}`, payload),

  remove: (id: string) => apiClient.delete(`/packages/${id}`),

  listComponents: (packageId: string, limit = 500, offset = 0) =>
    apiClient.get<PagedData<PackageComponentRecord>>(
      `/packages/${packageId}/components?limit=${limit}&offset=${offset}`,
    ),

  addComponent: (packageId: string, payload: AddPackageComponentPayload) =>
    apiClient.post<PackageComponentRecord>(
      `/packages/${packageId}/components`,
      payload,
    ),

  removeComponent: (
    packageId: string,
    componentType: PackageComponentType,
    componentId: string,
  ) =>
    apiClient.delete(
      `/packages/${packageId}/components/${componentType}/${componentId}`,
    ),
};
