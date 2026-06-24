import {
  buildControlFormulaSymbols,
  type FormulaControlContextInput,
} from "@goapps/formula";
import {
  defaultScreenContextStore,
  type RuntimeScreenContextStore,
} from "./runtime-screen-context-store";
import {
  defaultVariableStore,
  type RuntimeVariableStore,
} from "./runtime-variable-store";

export const HARDCODED_USER = {
  FullName: "Test User",
  Email: "test@example.com",
} as const;

export function buildFormulaRuntimeContext(
  appName = "Untitled Application",
  controls: FormulaControlContextInput[] = [],
  variableStore: RuntimeVariableStore = defaultVariableStore,
  screenContextStore: RuntimeScreenContextStore = defaultScreenContextStore,
): Record<string, unknown> {
  return {
    User: { ...HARDCODED_USER },
    App: { Name: appName },
    ...buildControlFormulaSymbols(controls),
    ...variableStore.getAll(),
    ...screenContextStore.getAll(),
  };
}

export type { FormulaControlContextInput };
