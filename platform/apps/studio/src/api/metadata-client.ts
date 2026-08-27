// Central metadata API client.
// In development, requests go through the Vite proxy (/api → localhost:8090/api (gateway))
// so no CORS headers are needed. In production, set VITE_API_BASE_URL.

import { activeSession, authHeaders, clearSession, authMode } from "../auth/session";

export const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1";

function redirectToLoginOnUnauthorized(): void {
  clearSession();
  if (authMode() === "development") return;
  const loginPath = "/login";
  if (typeof window !== "undefined" && !window.location.pathname.startsWith(loginPath)) {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`${loginPath}?returnTo=${encodeURIComponent(returnTo)}`);
  }
}

/** Resolves the active tenant for Studio API calls. */
export function getTenantId(): string {
  return (
    activeSession()?.tenantId ?? "00000000-0000-4000-8000-000000000001"
  );
}

/** @deprecated Use getTenantId() — retained for existing imports. */
export const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiErrorBody {
  code?: string;
  message?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string | ApiErrorBody;
}

export interface PagedData<T> {
  items: T[];
  total: number;
}

/** Normalize envelope error (string or {message}) into a displayable string. */
function formatApiError(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as ApiErrorBody).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: HeadersInit = {
    ...authHeaders(),
    ...init.headers,
  };

  const res = await fetch(url, { ...init, headers });

  if (res.status === 401) {
    redirectToLoginOnUnauthorized();
    throw new ApiError(401, "Session expired");
  }

  if (!res.ok) {
    let msg = res.statusText || "Request failed";
    try {
      const body = (await res.json()) as { error?: string | ApiErrorBody };
      msg = formatApiError(body.error, msg);
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, msg);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const body = (await res.json()) as ApiResponse<T>;
  if (!body.success)
    throw new ApiError(
      res.status,
      formatApiError(body.error, "Unknown error"),
    );
  return body.data;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  delete: (path: string) => request<void>(path, { method: "DELETE" }),
};
