import { authHeaders as sessionAuthHeaders } from "../auth/session";

const BASE_URL =
  (import.meta.env.VITE_RUNTIME_SERVICE_URL as string | undefined) ?? "/runtime-api/api";

export interface EntityRecordItem {
  recordId: string;
  entityId: string;
  tenantId: string;
  data: Record<string, unknown>;
  version: number;
  createdOn?: string;
  createdBy?: string | null;
  modifiedOn?: string;
  modifiedBy?: string | null;
}

interface RuntimeEnvelope<T> {
  success: boolean;
  data: T;
  error?: { code?: string; message?: string };
  meta?: { pagination?: { limit: number; offset: number; total: number } };
}

interface ListRecordsData {
  items: EntityRecordItem[];
  totalCount: number;
}

function authHeaders(): HeadersInit {
  return sessionAuthHeaders();
}

export class RecordsApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RecordsApiError";
  }
}

export const recordsApi = {
  list: async (
    entityId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ items: EntityRecordItem[]; total: number }> => {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const url = `${BASE_URL}/entities/${entityId}/records?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { headers: authHeaders() });

    const body = (await res.json()) as RuntimeEnvelope<ListRecordsData>;
    if (!res.ok || !body.success) {
      throw new RecordsApiError(
        res.status,
        body.error?.message ?? res.statusText ?? "Failed to load records",
      );
    }

    return {
      items: body.data?.items ?? [],
      total: body.meta?.pagination?.total ?? body.data?.totalCount ?? 0,
    };
  },
};
