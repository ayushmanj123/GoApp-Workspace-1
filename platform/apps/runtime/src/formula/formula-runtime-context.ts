import {
  buildControlFormulaSymbols,
  type FormulaControlContextInput,
} from "@goapps/formula";

export const HARDCODED_USER = {
  FullName: "Test User",
  Email: "test@example.com",
} as const;

export function buildFormulaRuntimeContext(
  appName = "Untitled Application",
  controls: FormulaControlContextInput[] = [],
): Record<string, unknown> {
  return {
    User: { ...HARDCODED_USER },
    App: { Name: appName },
    ...buildControlFormulaSymbols(controls),
  };
}

export type { FormulaControlContextInput };
