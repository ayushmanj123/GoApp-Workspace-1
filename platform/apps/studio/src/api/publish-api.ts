import { authHeaders } from "../auth/session";

export const PUBLISH_BASE_URL =
  (import.meta.env.VITE_PUBLISH_API_BASE_URL as string | undefined) ??
  "/publish-api/api/v1";

export interface PublishResult {
  application_id: string;
  version_id: string;
  version: string;
  status: string;
  snapshot_id: string;
  published_at: string;
}

export interface ApplicationVersionSummary {
  id: string;
  version: string;
  status: string;
  created_on: string;
}

export interface UnpublishResult {
  application_id: string;
  status: string;
}

export interface RollbackResult {
  application_id: string;
  version_id: string;
  version: string;
  status: string;
}

export interface DeprecateResult {
  application_id: string;
  version_id: string;
  version: string;
  status: string;
  application_status: string;
  was_current: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

async function publishRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${PUBLISH_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders(),
      ...init.headers,
    },
  });

  const body = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !body.success) {
    throw new Error(body.error ?? res.statusText);
  }
  return body.data;
}

export const publishApi = {
  publish: (applicationId: string, payload: { version?: string; notes?: string } = {}) =>
    publishRequest<PublishResult>(`/applications/${applicationId}/publish`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listVersions: (applicationId: string) =>
    publishRequest<{ items: ApplicationVersionSummary[]; total: number }>(
      `/applications/${applicationId}/versions`,
    ),

  unpublish: (applicationId: string) =>
    publishRequest<UnpublishResult>(`/applications/${applicationId}/unpublish`, {
      method: "POST",
    }),

  rollback: (applicationId: string, versionId: string) =>
    publishRequest<RollbackResult>(
      `/applications/${applicationId}/versions/${versionId}/rollback`,
      { method: "POST" },
    ),

  deprecate: (applicationId: string, versionId: string) =>
    publishRequest<DeprecateResult>(
      `/applications/${applicationId}/versions/${versionId}/deprecate`,
      { method: "POST" },
    ),
};
