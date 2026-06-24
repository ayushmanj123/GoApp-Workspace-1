import type { FormulaEngine } from "@goapps/formula";
import type { RuntimeVariableStore } from "./runtime-variable-store";
import { executeSet } from "./execute-set";

export interface RuntimeAction {
  formula: string;
}

export interface ActionServices {
  store: RuntimeVariableStore;
  engine: FormulaEngine;
  context: Record<string, unknown>;
}

/**
 * Executes a runtime action formula.
 *
 * Supported:  Set(varName, value)
 * Unsupported: anything else throws [Action Error]
 *
 * New action types (Navigate, UpdateContext, etc.) can be added here
 * in future phases without changing the call sites.
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

  throw new Error(`[Action Error]: unsupported action: ${trimmed}`);
}
