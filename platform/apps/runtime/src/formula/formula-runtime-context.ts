import {
  buildControlFormulaSymbols,
  type FormulaControlContextInput,
} from "@goapps/formula";
import {
  defaultScreenContextStore,
  type RuntimeScreenContextStore,
} from "./runtime-screen-context-store";
import {
  defaultCollectionStore,
  type RuntimeCollectionStore,
} from "./runtime-collection-store";
import {
  defaultGallerySelectionStore,
  type RuntimeGallerySelectionStore,
} from "./runtime-gallery-selection-store";
import {
  defaultFormUpdatesStore,
  type RuntimeFormUpdatesStore,
} from "./runtime-form-updates-store";
import {
  defaultVariableStore,
  type RuntimeVariableStore,
} from "./runtime-variable-store";
import {
  defaultControlValueStore,
  type RuntimeControlValueStore,
} from "./runtime-control-value-store";

export const HARDCODED_USER = {
  FullName: "Test User",
  Email: "test@example.com",
} as const;

function mergeControlSymbols(
  controls: FormulaControlContextInput[],
  controlValueStore: RuntimeControlValueStore = defaultControlValueStore,
): Record<string, unknown> {
  const base = buildControlFormulaSymbols(controls) as Record<
    string,
    Record<string, unknown>
  >;
  const live = controlValueStore.getSymbols();

  const merged: Record<string, unknown> = {};
  const names = new Set([...Object.keys(base), ...Object.keys(live)]);

  for (const name of names) {
    merged[name] = {
      ...(base[name] ?? {}),
      ...(live[name] ?? {}),
    };
  }

  return merged;
}

export function buildFormulaRuntimeContext(
  appName = "Untitled Application",
  controls: FormulaControlContextInput[] = [],
  variableStore: RuntimeVariableStore = defaultVariableStore,
  screenContextStore: RuntimeScreenContextStore = defaultScreenContextStore,
  collectionStore: RuntimeCollectionStore = defaultCollectionStore,
  gallerySelectionStore: RuntimeGallerySelectionStore = defaultGallerySelectionStore,
  formUpdatesStore: RuntimeFormUpdatesStore = defaultFormUpdatesStore,
  controlValueStore: RuntimeControlValueStore = defaultControlValueStore,
): Record<string, unknown> {
  return {
    User: { ...HARDCODED_USER },
    App: { Name: appName },
    ...mergeControlSymbols(controls, controlValueStore),
    ...variableStore.getAll(),
    ...screenContextStore.getAll(),
    ...collectionStore.getAll(),
    ...gallerySelectionStore.getAll(),
    ...formUpdatesStore.getAll(),
  };
}

export type { FormulaControlContextInput };
