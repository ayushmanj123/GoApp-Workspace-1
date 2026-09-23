import type { RenderScreenPayload } from "./utils/merge-render-package";
import {
  authHeaders as sessionAuthHeaders,
  clearSession,
  authMode,
} from "./auth/session";

export interface RuntimeFormulaSession {
  appId: string;
  sessionId: string;
  screen: string;
}

export interface RuntimeStateSnapshot {
  appId: string;
  sessionId: string;
  globalVariables: Record<string, unknown>;
  contextVariables: Record<string, Record<string, unknown>>;
  collections: Record<string, unknown[]>;
}

/** JSON-safe copy of the client formula context sent with each session evaluation. */
export function extractFormulaEvaluateOverlay(
  context?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!context) {
    return undefined;
  }
  try {
    const cloned = JSON.parse(JSON.stringify(context)) as Record<string, unknown>;
    return Object.keys(cloned).length > 0 ? cloned : undefined;
  } catch {
    return undefined;
  }
}

function runtimeBaseUrl(): string {
  return (
    (import.meta.env.VITE_RUNTIME_SERVICE_URL as string | undefined) ??
    "/runtime-api"
  );
}

function authHeaders(): HeadersInit {
  return sessionAuthHeaders();
}

function redirectToLoginOnUnauthorized(): void {
  clearSession();
  if (authMode() === "development") return;
  const loginPath = "/login";
  if (typeof window !== "undefined" && !window.location.pathname.startsWith(loginPath)) {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`${loginPath}?returnTo=${encodeURIComponent(returnTo)}`);
  }
}

async function handleUnauthorized(res: Response): Promise<void> {
  if (res.status === 401) {
    redirectToLoginOnUnauthorized();
  }
}

export async function startRuntimeSession(
  appId: string,
  screen: string,
  channel: "draft" | "published",
  environmentId?: string,
): Promise<string | undefined> {
  const res = await fetch(`${runtimeBaseUrl()}/api/runtime/session`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      appId,
      screen,
      channel,
      ...(environmentId ? { environmentId } : {}),
    }),
  });
  await handleUnauthorized(res);
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
  await handleUnauthorized(res);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.success) {
    return undefined;
  }
  return body.data as RenderScreenPayload;
}

export async function fetchRuntimeStateSnapshot(
  appId: string,
  sessionId: string,
): Promise<RuntimeStateSnapshot | undefined> {
  const params = new URLSearchParams({ appId });
  const res = await fetch(
    `${runtimeBaseUrl()}/api/runtime/state/${sessionId}?${params.toString()}`,
    { headers: authHeaders(), cache: "no-store" },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.success) {
    return undefined;
  }
  return body.data as RuntimeStateSnapshot;
}

export interface RuntimeFormulaEvaluateResult {
  result?: unknown;
  currentScreen?: string;
  refresh?: Array<{ controlId: string; reason: string }>;
}

export async function evaluateRuntimeFormula(input: {
  appId: string;
  sessionId: string;
  screen: string;
  formula: string;
  context?: Record<string, unknown>;
}): Promise<RuntimeFormulaEvaluateResult> {
  const res = await fetch(
    `${runtimeBaseUrl()}/api/runtime/session/${input.sessionId}/evaluate`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        appId: input.appId,
        screen: input.screen,
        formula: input.formula,
        context: input.context,
      }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.success) {
    const message =
      (body?.error?.message as string | undefined) ??
      `Runtime formula evaluation failed (${res.status}).`;
    throw new Error(message);
  }
  return {
    result: body.data?.result,
    currentScreen: body.data?.currentScreen as string | undefined,
    refresh: body.data?.refresh as
      | Array<{ controlId: string; reason: string }>
      | undefined,
  };
}

export interface ControlEventResult {
  result?: unknown;
  refresh?: Array<{ controlId: string; reason: string }>;
  currentScreen?: string;
}

export async function postControlEvent(input: {
  appId: string;
  sessionId: string;
  screen: string;
  controlId?: string;
  event: string;
}): Promise<ControlEventResult> {
  const res = await fetch(
    `${runtimeBaseUrl()}/api/runtime/session/${input.sessionId}/event`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        appId: input.appId,
        screen: input.screen,
        controlId: input.controlId,
        event: input.event,
      }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.success) {
    const message =
      (body?.error?.message as string | undefined) ??
      `Runtime control event failed (${res.status}).`;
    throw new Error(message);
  }
  return body.data as ControlEventResult;
}

export async function selectGalleryItem(input: {
  appId: string;
  sessionId: string;
  galleryName: string;
  index: number;
}): Promise<unknown> {
  const res = await fetch(
    `${runtimeBaseUrl()}/api/runtime/session/${input.sessionId}/gallery/${encodeURIComponent(input.galleryName)}/select`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ appId: input.appId, index: input.index }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.success) {
    const message =
      (body?.error?.message as string | undefined) ??
      `Gallery selection failed (${res.status}).`;
    throw new Error(message);
  }
  return body.data?.selected;
}

export interface RuntimeFormState {
  controlId: string;
  mode: "View" | "Edit" | "New" | string;
  currentRecord?: Record<string, unknown>;
  originalRecord?: Record<string, unknown>;
  dirtyFields?: Record<string, unknown>;
  validationErrors?: Array<{ field?: string; message: string }>;
  dataSource?: string;
  unsaved?: boolean;
  valid?: boolean;
  lastSubmit?: Record<string, unknown>;
  error?: { message?: string; issues?: Array<{ field?: string; message: string }> } | null;
  updates?: Record<string, unknown>;
}

async function parseFormResponse(res: Response): Promise<RuntimeFormState> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.success) {
    const message =
      (body?.error?.message as string | undefined) ??
      `Form request failed (${res.status}).`;
    throw new Error(message);
  }
  return (body.data?.form ?? body.data) as RuntimeFormState;
}

export async function fetchRuntimeForm(input: {
  sessionId: string;
  controlId: string;
}): Promise<RuntimeFormState> {
  const res = await fetch(
    `${runtimeBaseUrl()}/api/runtime/session/${input.sessionId}/form/${encodeURIComponent(input.controlId)}`,
    { headers: authHeaders(), cache: "no-store" },
  );
  await handleUnauthorized(res);
  return parseFormResponse(res);
}

export async function updateRuntimeForm(input: {
  appId: string;
  sessionId: string;
  controlId: string;
  fields: Record<string, unknown>;
}): Promise<RuntimeFormState> {
  const res = await fetch(
    `${runtimeBaseUrl()}/api/runtime/session/${input.sessionId}/form/${encodeURIComponent(input.controlId)}/update`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ appId: input.appId, fields: input.fields }),
    },
  );
  await handleUnauthorized(res);
  return parseFormResponse(res);
}

export async function resetRuntimeForm(input: {
  appId: string;
  sessionId: string;
  controlId: string;
}): Promise<RuntimeFormState> {
  const res = await fetch(
    `${runtimeBaseUrl()}/api/runtime/session/${input.sessionId}/form/${encodeURIComponent(input.controlId)}/reset`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ appId: input.appId }),
    },
  );
  await handleUnauthorized(res);
  return parseFormResponse(res);
}

export interface RuntimeGalleryState {
  controlId: string;
  source?: string;
  items: Record<string, unknown>[];
  selected?: Record<string, unknown>;
  count: number;
}

async function parseGalleryResponse(res: Response): Promise<RuntimeGalleryState> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.success) {
    const message =
      (body?.error?.message as string | undefined) ??
      `Gallery request failed (${res.status}).`;
    throw new Error(message);
  }
  const data = (body.data?.gallery ?? body.data) as RuntimeGalleryState;
  return {
    controlId: data.controlId,
    source: data.source,
    items: Array.isArray(data.items) ? data.items : [],
    selected: data.selected,
    count: typeof data.count === "number" ? data.count : (data.items?.length ?? 0),
  };
}

export async function fetchRuntimeGallery(input: {
  sessionId: string;
  controlId: string;
}): Promise<RuntimeGalleryState> {
  const res = await fetch(
    `${runtimeBaseUrl()}/api/runtime/session/${input.sessionId}/gallery/${encodeURIComponent(input.controlId)}`,
    { headers: authHeaders(), cache: "no-store" },
  );
  await handleUnauthorized(res);
  return parseGalleryResponse(res);
}

export async function reloadRuntimeGallery(input: {
  appId: string;
  sessionId: string;
  controlId: string;
}): Promise<RuntimeGalleryState> {
  const res = await fetch(
    `${runtimeBaseUrl()}/api/runtime/session/${input.sessionId}/gallery/${encodeURIComponent(input.controlId)}/reload`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ appId: input.appId }),
    },
  );
  await handleUnauthorized(res);
  return parseGalleryResponse(res);
}
