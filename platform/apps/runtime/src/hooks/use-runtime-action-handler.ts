import { useCallback } from "react";
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
import {
  useNavigationStore,
  useScreenResolver,
  useRuntime,
} from "../runtime-hooks";
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

const noopNavigationStore: RuntimeNavigationStore = {
  getCurrentScreenId: () => undefined,
  navigate: () => {},
  subscribe: () => () => {},
};

export function useRuntimeActionHandler(
  actionProperty: unknown,
  controlName: string | undefined,
  event: string,
) {
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
  } = useRuntime();

  const controls =
    pkg?.screens?.find((item) => item.id === currentScreen)?.controls ?? [];

  return useCallback(async () => {
    const formula = readActionFormula(actionProperty);
    if (!formula) {
      return;
    }

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
      entityNames: pkg?.entities?.map((entity) => entity.name) ?? [],
      navigateFromServer: navigateFromServer ?? undefined,
    };

    try {
      if (actionServices.session) {
        await executeRuntimeAction({ formula, controlName, event }, actionServices);
      } else {
        await executeAction({ formula }, actionServices);
      }
    } catch (err) {
      console.error(err);
    }
  }, [
    actionProperty,
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
    controlName,
    event,
    appId,
    sessionId,
    currentScreenName,
    navigateFromServer,
    runtimeUnavailable,
    pkg,
  ]);
}
