import type { RenderScreenPayload } from "./utils/merge-render-package";
import { authHeaders as sessionAuthHeaders } from "./auth/session";

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

const FORMULA_OVERLAY_KEYS = ["ThisItem", "Parent"] as const;

export function extractFormulaEvaluateOverlay(
  context?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!context) {
    return undefined;
  }
  const overlay: Record<string, unknown> = {};
  for (const key of FORMULA_OVERLAY_KEYS) {
    if (context[key] !== undefined) {
      overlay[key] = context[key];
    }
  }
  return Object.keys(overlay).length > 0 ? overlay : undefined;
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
