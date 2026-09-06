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

export interface ImportResult {
  created: number;
  failed: number;
  dryRun: boolean;
  errors?: { row: number; message: string }[];
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

async function parseEnvelope<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }
  const body = (await res.json()) as RuntimeEnvelope<T>;
  if (!res.ok || !body.success) {
    throw new RecordsApiError(
      res.status,
      body.error?.message ?? res.statusText ?? "Request failed",
    );
  }
  return body.data;
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

  create: async (
    entityId: string,
    data: Record<string, unknown>,
  ): Promise<EntityRecordItem> => {
    const res = await fetch(`${BASE_URL}/entities/${entityId}/records`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    return parseEnvelope<EntityRecordItem>(res);
  },

  update: async (
    entityId: string,
    recordId: string,
    data: Record<string, unknown>,
    version: number,
  ): Promise<EntityRecordItem> => {
    const res = await fetch(`${BASE_URL}/entities/${entityId}/records/${recordId}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ data, version }),
    });
    return parseEnvelope<EntityRecordItem>(res);
  },

  delete: async (entityId: string, recordId: string): Promise<void> => {
    const res = await fetch(`${BASE_URL}/entities/${entityId}/records/${recordId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok && res.status !== 204) {
      await parseEnvelope(res);
    }
  },

  importCsv: async (
    entityId: string,
    file: File,
    mapping: Record<string, string>,
    dryRun: boolean,
  ): Promise<ImportResult> => {
    const form = new FormData();
    form.append("file", file);
    form.append("mapping", JSON.stringify(mapping));
    form.append("dryRun", dryRun ? "true" : "false");
    const res = await fetch(`${BASE_URL}/entities/${entityId}/records/import`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    return parseEnvelope<ImportResult>(res);
  },

  associate: async (
    relationshipId: string,
    leftRecordId: string,
    rightRecordId: string,
  ): Promise<void> => {
    const res = await fetch(`${BASE_URL}/relationships/${relationshipId}/associate`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ leftRecordId, rightRecordId }),
    });
    if (!res.ok && res.status !== 204) {
      await parseEnvelope(res);
    }
  },

  disassociate: async (
    relationshipId: string,
    leftRecordId: string,
    rightRecordId: string,
  ): Promise<void> => {
    const res = await fetch(`${BASE_URL}/relationships/${relationshipId}/disassociate`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ leftRecordId, rightRecordId }),
    });
    if (!res.ok && res.status !== 204) {
      await parseEnvelope(res);
    }
  },

  listRelated: async (
    relationshipId: string,
    recordId: string,
    side: "left" | "right" = "left",
  ): Promise<string[]> => {
    const res = await fetch(
      `${BASE_URL}/relationships/${relationshipId}/related/${recordId}?side=${side}`,
      { headers: authHeaders() },
    );
    const data = await parseEnvelope<{ recordIds: string[] }>(res);
    return data?.recordIds ?? [];
  },
};
