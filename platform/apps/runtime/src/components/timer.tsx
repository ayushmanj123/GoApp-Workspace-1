import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  useFormulaEngine,
  useFormulaEvaluationContext,
  useVariableStore,
  useScreenContextStore,
  useCollectionStore,
  useGallerySelectionStore,
  useFormUpdatesStore,
  useRecordStore,
} from "../formula/formula-context";
import { useNavigationStore, useScreenResolver, useRuntime } from "../runtime-hooks";
import { executeRuntimeAction } from "../formula/execute-runtime-action";
import { executeAction } from "../formula/execute-action";
import type { RuntimeNavigationStore } from "../formula/runtime-navigation-store";

function readActionFormula(property: unknown): string | null {
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    if (typeof formula === "string" && formula.trim()) {
      return formula.trim();
    }
  }
  return null;
}

function readDuration(property: unknown): number {
  if (property && typeof property === "object" && "value" in property) {
    const parsed = Number((property as { value: unknown }).value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  if (typeof property === "number" && property > 0) {
    return property;
  }
  return 0;
}

function readBoolean(property: unknown, fallback: boolean): boolean {
  if (typeof property === "boolean") {
    return property;
  }
  if (property && typeof property === "object" && "value" in property) {
    const wrapped = (property as { value: unknown }).value;
    if (typeof wrapped === "boolean") {
      return wrapped;
    }
    if (typeof wrapped === "string") {
      const trimmed = wrapped.trim().toLowerCase();
      if (trimmed === "true" || trimmed === "1") return true;
      if (trimmed === "false" || trimmed === "0") return false;
    }
  }
  if (typeof property === "string") {
    const trimmed = property.trim().toLowerCase();
    if (trimmed === "true" || trimmed === "1") return true;
    if (trimmed === "false" || trimmed === "0") return false;
  }
  return fallback;
}

const noopNavigationStore: RuntimeNavigationStore = {
  getCurrentScreenId: () => undefined,
  navigate: () => {},
  subscribe: () => () => {},
};

export const Timer: React.FC<any> = ({
  duration,
  onTimerEnd,
  autoStart,
  start,
  repeat,
  onTimerStart,
  autoPause,
  controlName,
  name,
  disabled = false,
}) => {
  const engine = useFormulaEngine();
  const context = useFormulaEvaluationContext();
  const store = useVariableStore();
  const screenContextStore = useScreenContextStore();
  const collectionStore = useCollectionStore();
  const gallerySelectionStore = useGallerySelectionStore();
  const formUpdatesStore = useFormUpdatesStore();
  const recordStore = useRecordStore();
  const navigationStore = useNavigationStore() ?? noopNavigationStore;
  const resolveScreenId = useScreenResolver() ?? (() => undefined);
  const {
    pkg,
    currentScreen,
    appId,
    sessionId,
    currentScreenName,
    navigateFromServer,
    runtimeUnavailable,
    bumpGalleryRefresh,
  } = useRuntime();
  const resolvedControlName = controlName ?? name;
  const controls = useMemo(() => {
    const screen = pkg?.screens?.find((item) => item.id === currentScreen);
    return screen?.controls ?? [];
  }, [pkg, currentScreen]);

  const durationMs = readDuration(duration);
  const formula = readActionFormula(onTimerEnd);
  const startFormula = readActionFormula(onTimerStart);
  const autoStartEnabled = readBoolean(autoStart, true);
  const startEnabled = readBoolean(start, true);
  const repeatEnabled = readBoolean(repeat, false);
  const autoPauseEnabled = readBoolean(autoPause, false);
  const [pageVisible, setPageVisible] = useState(true);
  useEffect(() => {
    if (!autoPauseEnabled) return;
    const onVisibility = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [autoPauseEnabled]);
  const isRunning =
    !disabled &&
    startEnabled &&
    (autoStartEnabled || startEnabled) &&
    (!autoPauseEnabled || pageVisible) &&
    durationMs > 0 &&
    Boolean(formula || startFormula);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearScheduled = () => {
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    if (!isRunning || !formula) {
      clearScheduled();
      return;
    }

    const runTimerEnd = () => {
      const actionServices = {
        store,
        screenContextStore,
        collectionStore,
        formUpdatesStore,
        recordStore,
        controls,
        gallerySelectionStore,
        navigationStore,
        resolveScreenId,
        engine,
        context,
        session:
          sessionId && appId && currentScreenName && !runtimeUnavailable
            ? { appId, sessionId, screen: currentScreenName }
            : undefined,
        entityNames: [
          ...(pkg?.entities?.map((entity) => entity.name) ?? []),
          ...(pkg?.connectors?.map((connector) => connector.name) ?? []),
        ],
        navigateFromServer: navigateFromServer ?? undefined,
        bumpGalleryRefresh,
      };

      const run = actionServices.session
        ? executeRuntimeAction(
            {
              formula,
              controlName: resolvedControlName,
              event: "OnTimerEnd",
            },
            actionServices,
          )
        : executeAction({ formula }, actionServices);

      void run.catch((err) => {
        console.error("[Timer Error]", err);
      });
    };

    const runTimerStart = () => {
      if (!startFormula) return;
      const actionServices = {
        store,
        screenContextStore,
        collectionStore,
        formUpdatesStore,
        recordStore,
        controls,
        gallerySelectionStore,
        navigationStore,
        resolveScreenId,
        engine,
        context,
        session:
          sessionId && appId && currentScreenName && !runtimeUnavailable
            ? { appId, sessionId, screen: currentScreenName }
            : undefined,
        entityNames: [
          ...(pkg?.entities?.map((entity) => entity.name) ?? []),
          ...(pkg?.connectors?.map((connector) => connector.name) ?? []),
        ],
        navigateFromServer: navigateFromServer ?? undefined,
        bumpGalleryRefresh,
      };
      const run = actionServices.session
        ? executeRuntimeAction(
            { formula: startFormula, controlName: resolvedControlName, event: "OnTimerStart" },
            actionServices,
          )
        : executeAction({ formula: startFormula }, actionServices);
      void run.catch((err) => console.error("[Timer Error]", err));
    };

    const schedule = () => {
      clearScheduled();
      runTimerStart();
      if (!formula) return;
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        runTimerEnd();
        if (repeatEnabled && startEnabled && !disabled) {
          schedule();
        }
      }, durationMs);
    };

    schedule();

    return () => {
      clearScheduled();
    };
  }, [
    isRunning,
    formula,
    startFormula,
    durationMs,
    repeatEnabled,
    startEnabled,
    disabled,
    store,
    screenContextStore,
    collectionStore,
    formUpdatesStore,
    recordStore,
    controls,
    gallerySelectionStore,
    navigationStore,
    resolveScreenId,
    engine,
    context,
    sessionId,
    appId,
    currentScreenName,
    runtimeUnavailable,
    pkg,
    navigateFromServer,
    resolvedControlName,
    bumpGalleryRefresh,
  ]);

  return <span data-testid="timer-control">[Timer]</span>;
};

export default Timer;
