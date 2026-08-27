import React, { useCallback, useMemo } from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
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

export const Button: React.FC<any> = ({
  text = "Button",
  disabled = false,
  onSelect,
  onClick,
  controlName,
  name,
}) => {
  const label = useResolvedPropertyText(text, "Button");
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

  const handleClick = useCallback(async () => {
    const formula = readActionFormula(onSelect);
    if (!formula) {
      onClick?.();
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
      entityNames: [
        ...(pkg?.entities?.map((entity) => entity.name) ?? []),
        ...(pkg?.connectors?.map((connector) => connector.name) ?? []),
      ],
      navigateFromServer: navigateFromServer ?? undefined,
      bumpGalleryRefresh,
    };

    try {
      if (actionServices.session) {
        await executeRuntimeAction(
          { formula, controlName: resolvedControlName, event: "OnSelect" },
          actionServices,
        );
      } else {
        await executeAction({ formula }, actionServices);
      }
    } catch (err) {
      console.error(err);
    }
    onClick?.();
  }, [
    onSelect,
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
    onClick,
    resolvedControlName,
    appId,
    sessionId,
    currentScreenName,
    navigateFromServer,
    runtimeUnavailable,
    pkg,
    bumpGalleryRefresh,
  ]);

  return (
    <button disabled={disabled} onClick={handleClick} style={{ width: "100%", height: "100%" }}>
      {label}
    </button>
  );
};
export default Button;
