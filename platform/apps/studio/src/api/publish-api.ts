export const PUBLISH_BASE_URL =
  (import.meta.env.VITE_PUBLISH_API_BASE_URL as string | undefined) ??
  "/publish-api/api/v1";

export const TENANT_ID = "00000000-0000-4000-8000-000000000001";

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
      "Content-Type": "application/json",
      "X-Tenant-Id": TENANT_ID,
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
};
