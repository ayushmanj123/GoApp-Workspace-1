// Central metadata API client.
// In development, requests go through the Vite proxy (/api → localhost:8082/api)
// so no CORS headers are needed. In production, set VITE_API_BASE_URL.

import { activeSession, authHeaders } from "../auth/session";

export const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1";

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

  if (!res.ok) {
    let msg = res.statusText || "Request failed";
    try {
      const body = (await res.json()) as { error?: string | ApiErrorBody };
      // #region agent log
      fetch('http://127.0.0.1:7840/ingest/130eab88-94ac-4f4f-9bd0-61f1155336b0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03a9e4'},body:JSON.stringify({sessionId:'03a9e4',runId:'post-fix',hypothesisId:'A',location:'metadata-client.ts:!res.ok',message:'API non-OK response',data:{path,status:res.status,errorType:typeof body.error,errorIsObject:body.error!==null&&typeof body.error==='object',errorValue:body.error,formattedMsg:formatApiError(body.error,msg),statusText:res.statusText},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      msg = formatApiError(body.error, msg);
    } catch {
      // ignore parse errors
    }
    // #region agent log
    fetch('http://127.0.0.1:7840/ingest/130eab88-94ac-4f4f-9bd0-61f1155336b0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03a9e4'},body:JSON.stringify({sessionId:'03a9e4',runId:'post-fix',hypothesisId:'A',location:'metadata-client.ts:throw-ApiError',message:'Throwing ApiError with msg',data:{path,status:res.status,msgType:typeof msg,msgIsObject:msg!==null&&typeof msg==='object',msgString:String(msg)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw new ApiError(res.status, msg);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const body = (await res.json()) as ApiResponse<T>;
  // #region agent log
  if (path.includes('/environments')) {
    fetch('http://127.0.0.1:7840/ingest/130eab88-94ac-4f4f-9bd0-61f1155336b0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03a9e4'},body:JSON.stringify({sessionId:'03a9e4',runId:'post-fix',hypothesisId:'B',location:'metadata-client.ts:ok-body',message:'Environments OK-path body',data:{path,status:res.status,success:body.success,errorType:typeof body.error,hasData:body.data!=null},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion
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
