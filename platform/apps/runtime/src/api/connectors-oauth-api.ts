import { authHeaders } from "../auth/session";

const METADATA_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1";

async function metadataFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${METADATA_BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: string;
  };
  if (!res.ok || body.success === false) {
    throw new Error(
      typeof body.error === "string" ? body.error : res.statusText || "Request failed",
    );
  }
  return body.data as T;
}

export interface OAuthConnectionStatus {
  connected: boolean;
  connection_scope: string;
}

export const connectorsOAuthApi = {
  getConnection: (connectorId: string) =>
    metadataFetch<OAuthConnectionStatus>(
      `/connectors/${connectorId}/oauth/connection`,
    ),

  startOAuth: (connectorId: string, returnTo: "studio" | "runtime" = "runtime") =>
    metadataFetch<{ authorize_url: string; state: string }>(
      `/connectors/${connectorId}/oauth/start`,
      {
        method: "POST",
        body: JSON.stringify({ return_to: returnTo }),
      },
    ),
};
