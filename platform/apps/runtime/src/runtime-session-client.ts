import type { RenderScreenPayload } from "./utils/merge-render-package";

const TENANT_ID =
  (import.meta.env.VITE_TENANT_ID as string | undefined) ??
  "00000000-0000-4000-8000-000000000001";
const USER_ID =
  (import.meta.env.VITE_USER_ID as string | undefined) ??
  "00000000-0000-4000-8000-000000000002";

function runtimeBaseUrl(): string {
  return (
    (import.meta.env.VITE_RUNTIME_SERVICE_URL as string | undefined) ??
    "/runtime-api"
  );
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer dev:${TENANT_ID}:${USER_ID}:dev@example.com`,
    "Content-Type": "application/json",
  };
}

export async function startRuntimeSession(
  appId: string,
  screen: string,
  channel: "draft" | "published",
): Promise<string | undefined> {
  const res = await fetch(`${runtimeBaseUrl()}/api/runtime/session`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ appId, screen, channel }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.success) {
    return undefined;
  }
  return body.data?.sessionId as string | undefined;
}

export async function fetchRenderedScreen(
  sessionId: string,
  screenId: string,
): Promise<RenderScreenPayload | undefined> {
  const res = await fetch(
    `${runtimeBaseUrl()}/api/runtime/session/${sessionId}/render/${screenId}`,
    { headers: authHeaders(), cache: "no-store" },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.success) {
    return undefined;
  }
  return body.data as RenderScreenPayload;
}
