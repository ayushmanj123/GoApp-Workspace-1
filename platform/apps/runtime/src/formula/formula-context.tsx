import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createDefaultFormulaEngine,
  type FormulaEngine,
  type FormulaControlContextInput,
} from "@goapps/formula";
import {
  buildFormulaRuntimeContext,
  HARDCODED_USER,
} from "./formula-runtime-context";
import {
  defaultVariableStore,
  type RuntimeVariableStore,
} from "./runtime-variable-store";
import { executeSet } from "./execute-set";

const FormulaContext = createContext<FormulaEngine | null>(null);
const FormulaEvaluationContext = createContext<Record<string, unknown>>(
  buildFormulaRuntimeContext(),
);
const VariableStoreContext =
  createContext<RuntimeVariableStore>(defaultVariableStore);

interface FormulaProviderProps {
  engine?: FormulaEngine;
  appName?: string;
  controls?: FormulaControlContextInput[];
  variableStore?: RuntimeVariableStore;
  children: ReactNode;
}

export function FormulaProvider({
  engine,
  appName,
  controls = [],
  variableStore,
  children,
}: FormulaProviderProps) {
  const resolvedStore = variableStore ?? defaultVariableStore;

  const formulaEngine = useMemo(
    () => engine ?? createDefaultFormulaEngine(),
    [engine],
  );

  // Incremented whenever the store notifies of a change so that
  // evaluationContext is recomputed with fresh variable values.
  const [storeVersion, setStoreVersion] = useState(0);

  useEffect(() => {
    return resolvedStore.subscribe(() => setStoreVersion((v) => v + 1));
  }, [resolvedStore]);

  useEffect(() => {
    void formulaEngine.initialize();
  }, [formulaEngine]);

  const evaluationContext = useMemo(
    // storeVersion is intentionally included to force rebuild on variable changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => buildFormulaRuntimeContext(appName, controls, resolvedStore),
    [appName, controls, resolvedStore, storeVersion],
  );

  return (
    <FormulaContext.Provider value={formulaEngine}>
      <FormulaEvaluationContext.Provider value={evaluationContext}>
        <VariableStoreContext.Provider value={resolvedStore}>
          {children}
        </VariableStoreContext.Provider>
      </FormulaEvaluationContext.Provider>
    </FormulaContext.Provider>
  );
}

export function useFormulaEngine(): FormulaEngine {
  const engine = useContext(FormulaContext);
  if (!engine) {
    throw new Error("useFormulaEngine must be used within FormulaProvider");
  }
  return engine;
}

export function useFormulaEvaluationContext(): Record<string, unknown> {
  return useContext(FormulaEvaluationContext);
}

export function useVariableStore(): RuntimeVariableStore {
  return useContext(VariableStoreContext);
}

/**
 * Returns a stable callback that executes a Set(varName, value) formula
 * and updates the RuntimeVariableStore, triggering reactive re-evaluation.
 */
export function useSet(): (formula: string) => Promise<void> {
  const engine = useFormulaEngine();
  const context = useFormulaEvaluationContext();
  const store = useVariableStore();

  return useCallback(
    async (formula: string) => {
      await executeSet(formula, store, engine, context);
    },
    [engine, context, store],
  );
}

export { HARDCODED_USER, buildFormulaRuntimeContext };
export type { RuntimeVariableStore };
