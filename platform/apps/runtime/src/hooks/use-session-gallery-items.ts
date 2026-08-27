import { useCallback, useEffect, useState } from "react";
import { useResolvedGalleryRecords } from "./use-resolved-gallery-items";
import { normalizeGalleryRecords } from "../utils/gallery-rows";
import { useRuntime } from "../runtime-hooks";
import {
  fetchRuntimeGallery,
  reloadRuntimeGallery,
} from "../runtime-session-client";

export interface SessionGalleryItemsResult {
  records: Record<string, unknown>[];
  source?: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Prefer session gallery GET when a runtime session + controlId exist;
 * otherwise fall back to formula/collection resolution.
 */
export function useSessionGalleryItems(
  controlId: string | undefined,
  items: unknown,
  refreshTick = 0,
): SessionGalleryItemsResult {
  const {
    appId,
    sessionId,
    galleryRefreshTick = 0,
    runtimeUnavailable,
  } = useRuntime();
  const fallbackRecords = useResolvedGalleryRecords(items);
  const hasSession = Boolean(
    sessionId && appId && controlId && !runtimeUnavailable,
  );

  const [sessionRecords, setSessionRecords] = useState<Record<string, unknown>[]>(
    [],
  );
  const [source, setSource] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  const load = useCallback(async () => {
    if (!hasSession || !sessionId || !controlId) {
      setSessionReady(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const state = await fetchRuntimeGallery({ sessionId, controlId });
      setSessionRecords(normalizeGalleryRecords(state.items));
      setSource(state.source);
      setSessionReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rows");
      setSessionReady(false);
    } finally {
      setLoading(false);
    }
  }, [controlId, hasSession, sessionId]);

  const refresh = useCallback(async () => {
    if (!hasSession || !sessionId || !appId || !controlId) {
      await load();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const state = await reloadRuntimeGallery({ appId, sessionId, controlId });
      setSessionRecords(normalizeGalleryRecords(state.items));
      setSource(state.source);
      setSessionReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh rows");
      // Fall back to GET if reload endpoint unavailable.
      await load();
    } finally {
      setLoading(false);
    }
  }, [appId, controlId, hasSession, load, sessionId]);

  useEffect(() => {
    void load();
  }, [load, refreshTick, galleryRefreshTick]);

  if (hasSession && sessionReady) {
    return {
      records: sessionRecords,
      source,
      loading,
      error,
      refresh,
    };
  }

  return {
    records: fallbackRecords,
    source,
    loading: hasSession ? loading : false,
    error,
    refresh,
  };
}
