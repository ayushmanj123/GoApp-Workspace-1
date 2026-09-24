import type { FormulaEngine } from "@goapps/formula";
import type { RuntimeCollectionStore } from "./runtime-collection-store";
import type { RuntimeFormUpdatesStore } from "./runtime-form-updates-store";
import type { RuntimeGallerySelectionStore } from "./runtime-gallery-selection-store";
import type { RuntimeNavigationStore } from "./runtime-navigation-store";
import type { RuntimeRecordStore } from "./runtime-record-store";
import type { RuntimeScreenContextStore } from "./runtime-screen-context-store";
import type { RuntimeControlValueStore } from "./runtime-control-value-store";
import type { RuntimeVariableStore } from "./runtime-variable-store";
import { executeClearCollect, executeCollect } from "./execute-collect";
import { executeClientHost } from "./execute-host";
import { executeNavigate } from "./execute-navigate";
import { executeSet } from "./execute-set";
import { executeSubmitForm, type SubmitFormControl } from "./execute-submit-form";
import { executeUpdateContext } from "./execute-update-context";
export interface RuntimeAction {
  formula: string;
}

export interface ActionServices {
  store: RuntimeVariableStore;
  screenContextStore: RuntimeScreenContextStore;
  collectionStore: RuntimeCollectionStore;
  formUpdatesStore: RuntimeFormUpdatesStore;
  recordStore: RuntimeRecordStore;
  controls: SubmitFormControl[];
  gallerySelectionStore?: RuntimeGallerySelectionStore;
  navigationStore: RuntimeNavigationStore;
  resolveScreenId: (name: string) => string | undefined;
  engine: FormulaEngine;
  context: Record<string, unknown>;
  controlValueStore?: RuntimeControlValueStore;
  notify?: (message: string) => void;
  runFormula?: (formula: string) => Promise<void>;
}

/**
 * Executes a runtime action formula.
 *
 * Supported host functions plus Set, UpdateContext, Navigate, Collect, ClearCollect, and SubmitForm.
 * Unsupported formulas throw [Action Error].
 */
export async function executeAction(
  action: RuntimeAction,
  services: ActionServices,
): Promise<void> {
  const trimmed = action.formula.trim();

  if (/^ClearCollect\s*\(/i.test(trimmed)) {
    executeClearCollect(trimmed, services.collectionStore);
    return;
  }

  if (/^Collect\s*\(/i.test(trimmed)) {
    executeCollect(trimmed, services.collectionStore);
    return;
  }

  if (/^Set\s*\(/i.test(trimmed)) {
    await executeSet(
      trimmed,
      services.store,
      services.engine,
      services.context,
    );
    return;
  }

  if (/^UpdateContext\s*\(/i.test(trimmed)) {
    executeUpdateContext(trimmed, services.screenContextStore);
    return;
  }

  if (/^Navigate\s*\(/i.test(trimmed)) {
    executeNavigate(
      trimmed,
      services.navigationStore,
      services.resolveScreenId,
      services.screenContextStore,
      services.gallerySelectionStore,
    );
    return;
  }

  if (/^(Notify|Reset|Select|Launch|Sort|SortByColumns|Search|ForAll)\s*\(/i.test(trimmed)) {
    await executeClientHost(trimmed, services);
    return;
  }

  if (/^SubmitForm\s*\(/i.test(trimmed)) {
    // Offline / design-time only. Session apps must use executeRuntimeAction → Go Form Service.
    executeSubmitForm(
      trimmed,
      services.formUpdatesStore,
      services.recordStore,
      services.controls,
    );
    return;
  }

  throw new Error(`[Action Error]: unsupported action: ${trimmed}`);
}
