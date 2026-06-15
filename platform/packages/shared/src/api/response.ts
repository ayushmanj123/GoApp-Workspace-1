/** Standard API error shape returned by all GoApps Platform services. */
export interface ApiError {
  code: string;
  message: string;
}

/** Request metadata included in every API response. */
export interface ApiMeta {
  requestId: string;
  timestamp: string;
}

/** Standard API response envelope used across all services. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

/** Build a successful API response (client-side helper). */
export function ok<T>(data: T, requestId = ''): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: { requestId, timestamp: new Date().toISOString() },
  };
}

/** Build a failed API response (client-side helper). */
export function fail(code: string, message: string, requestId = ''): ApiResponse<never> {
  return {
    success: false,
    error: { code, message },
    meta: { requestId, timestamp: new Date().toISOString() },
  };
}

/** Health check payload returned by service health endpoints. */
export interface HealthStatus {
  status: string;
  service: string;
}
