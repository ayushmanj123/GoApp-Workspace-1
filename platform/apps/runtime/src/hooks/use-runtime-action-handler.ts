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
  useControlValueStore,
} from "../formula/formula-context";
import {
  useNavigationStore,
  useScreenResolver,
  useRuntime,
} from "../runtime-hooks";
import {
  executeRuntimeAction,
  type RuntimeActionServices,
} from "../formula/execute-runtime-action";
import { executeAction } from "../formula/execute-action";
import { flushAllFormUpdates } from "../formula/form-update-flush";
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
  const controlValueStore = useControlValueStore();
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
    reportActionError,
    reportNotice,
    clearActionError,
    bumpFormRefresh,
    bumpGalleryRefresh,
  } = useRuntime();

  const controls =
    pkg?.screens?.find((item) => item.id === currentScreen)?.controls ?? [];

  return useCallback(async () => {
    const formula = readActionFormula(actionProperty);
    if (!formula) {
      return;
    }

    const actionServices: RuntimeActionServices = {
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
      controlValueStore,
      notify: reportNotice,
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
    actionServices.runFormula = async (nextFormula: string) => {
      if (actionServices.session) {
        await executeRuntimeAction(
          { formula: nextFormula, controlName, event },
          actionServices,
        );
      } else {
        await executeAction({ formula: nextFormula }, actionServices);
      }
    };

    try {
      if (/SubmitForm|ResetForm|NewForm|EditForm|ViewForm/i.test(formula)) {
        await flushAllFormUpdates();
      }
      if (actionServices.session) {
        await executeRuntimeAction({ formula, controlName, event }, actionServices);
      } else {
        await executeAction({ formula }, actionServices);
        if (/Refresh\s*\(/i.test(formula)) {
          bumpGalleryRefresh?.();
        }
      }
      if (/SubmitForm|ResetForm|NewForm|EditForm|ViewForm/i.test(formula)) {
        bumpFormRefresh?.();
        if (/ResetForm/i.test(formula)) {
          formUpdatesStore.clear();
        }
      }
      clearActionError?.();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Action failed";
      reportActionError?.(message);
      bumpFormRefresh?.();
      bumpGalleryRefresh?.();
    }
  }, [
    actionProperty,
    store,
    screenContextStore,
    collectionStore,
    formUpdatesStore,
    recordStore,
    controlValueStore,
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
    reportActionError,
    reportNotice,
    clearActionError,
    bumpFormRefresh,
    bumpGalleryRefresh,
  ]);
}
