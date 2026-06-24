import type { FormulaEngine } from "@goapps/formula";
import type { RuntimeScreenContextStore } from "./runtime-screen-context-store";
import type { RuntimeVariableStore } from "./runtime-variable-store";
import { executeSet } from "./execute-set";
import { executeUpdateContext } from "./execute-update-context";

export interface RuntimeAction {
  formula: string;
}

export interface ActionServices {
  store: RuntimeVariableStore;
  screenContextStore: RuntimeScreenContextStore;
  engine: FormulaEngine;
  context: Record<string, unknown>;
}

/**
 * Executes a runtime action formula.
 *
 * Supported:  Set(varName, value), UpdateContext({ key: "value" })
 * Unsupported: anything else throws [Action Error]
 */
export async function executeAction(
  action: RuntimeAction,
  services: ActionServices,
): Promise<void> {
  const trimmed = action.formula.trim();

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

  throw new Error(`[Action Error]: unsupported action: ${trimmed}`);
}
