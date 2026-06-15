import type { ApiResponse, HealthStatus } from '@goapps/shared';

export interface ClientOptions {
  /** Base URL of the target service (e.g. http://localhost:8081). */
  baseUrl: string;
  /** Optional default headers applied to every request. */
  headers?: Record<string, string>;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...options.headers,
    },
  });

  return response.json() as Promise<ApiResponse<T>>;
}

/** Creates a typed HTTP client for a GoApps Platform service. */
export function createClient({ baseUrl, headers = {} }: ClientOptions) {
  const base = baseUrl.replace(/\/$/, '');

  return {
    /** Calls the service liveness endpoint. */
    health(): Promise<ApiResponse<HealthStatus>> {
      return request<HealthStatus>(`${base}/health`, { headers });
    },

    /** Calls the service readiness endpoint. */
    ready(): Promise<ApiResponse<HealthStatus>> {
      return request<HealthStatus>(`${base}/ready`, { headers });
    },
  };
}

export type GoAppsClient = ReturnType<typeof createClient>;
