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
  const { pkg, currentScreen } = useRuntime();
  const controls = useMemo(() => {
    const screen = pkg?.screens?.find((item) => item.id === currentScreen);
    return screen?.controls ?? [];
  }, [pkg, currentScreen]);

  const handleClick = useCallback(async () => {
    const formula = readActionFormula(onSelect);
    if (formula) {
      try {
        await executeAction(
          { formula },
          {
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
          },
        );
      } catch (err) {
        console.error(err);
      }
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
  ]);

  return (
    <button disabled={disabled} onClick={handleClick} style={{ width: "100%", height: "100%" }}>
      {label}
    </button>
  );
};
export default Button;
