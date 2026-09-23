import React, { useCallback, useMemo, useState } from "react";
import {
  useResolvedBoolean,
  useResolvedPropertyText,
} from "../hooks/use-resolved-property-text";
import { useControlChrome } from "../hooks/use-control-chrome";
import { readBooleanProperty } from "../utils/appearance-style";
import { iconGlyph } from "../utils/icon-glyphs";
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

export const Button: React.FC<any> = (props) => {
  const {
    text = "Button",
    disabled = false,
    onSelect,
    onClick,
    controlName,
    name,
    tooltip,
    autoDisableOnSelect,
    icon,
  } = props;
  const resolvedDisabled = useResolvedBoolean(disabled, false);
  const label = useResolvedPropertyText(text, "Button");
  const resolvedTooltip = useResolvedPropertyText(tooltip);
  const resolvedIcon = useResolvedPropertyText(icon, "");
  const glyph = resolvedIcon ? iconGlyph(resolvedIcon) : "";
  const autoDisable = readBooleanProperty(autoDisableOnSelect, false);
  const [pendingDisable, setPendingDisable] = useState(false);
  const chrome = useControlChrome(props, {
    disabled: resolvedDisabled || pendingDisable,
    includeText: true,
  });
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
    if (autoDisable) setPendingDisable(true);
    const formula = readActionFormula(onSelect);
    if (!formula) {
      onClick?.();
      if (autoDisable) setPendingDisable(false);
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
    } finally {
      if (autoDisable) setPendingDisable(false);
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
    autoDisable,
  ]);

  return (
    <button
      disabled={resolvedDisabled || pendingDisable}
      title={resolvedTooltip || undefined}
      tabIndex={chrome.tabIndex}
      onClick={handleClick}
      style={{
        width: "100%",
        height: "100%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        boxSizing: "border-box",
        ...chrome.style,
      }}
      {...chrome.handlers}
    >
      {glyph ? <span aria-hidden="true">{glyph}</span> : null}
      {label}
    </button>
  );
};
export default Button;
