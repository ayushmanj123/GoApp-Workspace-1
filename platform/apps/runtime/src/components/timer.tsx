import React, { useEffect, useMemo, useRef } from "react";
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

const noopNavigationStore: RuntimeNavigationStore = {
  getCurrentScreenId: () => undefined,
  navigate: () => {},
  subscribe: () => () => {},
};

export const Timer: React.FC<any> = ({
  duration,
  onTimerEnd,
  controlName,
  name,
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
  const firedRef = useRef(false);

  useEffect(() => {
    if (!formula || durationMs <= 0 || firedRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (firedRef.current) {
        return;
      }
      firedRef.current = true;

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
    }, durationMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    formula,
    durationMs,
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

  return <span>[Timer]</span>;
};

export default Timer;
