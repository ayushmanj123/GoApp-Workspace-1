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
  defaultScreenContextStore,
  type RuntimeScreenContextStore,
} from "./runtime-screen-context-store";
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

const ScreenContextStoreContext =
  createContext<RuntimeScreenContextStore>(defaultScreenContextStore);

interface FormulaProviderProps {
  engine?: FormulaEngine;
  appName?: string;
  controls?: FormulaControlContextInput[];
  variableStore?: RuntimeVariableStore;
  screenContextStore?: RuntimeScreenContextStore;
  children: ReactNode;
}

export function FormulaProvider({
  engine,
  appName,
  controls = [],
  variableStore,
  screenContextStore,
  children,
}: FormulaProviderProps) {
  const resolvedStore = variableStore ?? defaultVariableStore;
  const resolvedScreenStore = screenContextStore ?? defaultScreenContextStore;

  const formulaEngine = useMemo(
    () => engine ?? createDefaultFormulaEngine(),
    [engine],
  );

  const [contextVersion, setContextVersion] = useState(0);

  useEffect(() => {
    return resolvedStore.subscribe(() => setContextVersion((v) => v + 1));
  }, [resolvedStore]);

  useEffect(() => {
    return resolvedScreenStore.subscribe(() => setContextVersion((v) => v + 1));
  }, [resolvedScreenStore]);

  useEffect(() => {
    void formulaEngine.initialize();
  }, [formulaEngine]);

  const evaluationContext = useMemo(
    () =>
      buildFormulaRuntimeContext(
        appName,
        controls,
        resolvedStore,
        resolvedScreenStore,
      ),
    [appName, controls, resolvedStore, resolvedScreenStore, contextVersion],
  );

  return (
    <FormulaContext.Provider value={formulaEngine}>
      <FormulaEvaluationContext.Provider value={evaluationContext}>
        <VariableStoreContext.Provider value={resolvedStore}>
          <ScreenContextStoreContext.Provider value={resolvedScreenStore}>
            {children}
          </ScreenContextStoreContext.Provider>
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

export function useScreenContextStore(): RuntimeScreenContextStore {
  return useContext(ScreenContextStoreContext);
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
export type { RuntimeVariableStore, RuntimeScreenContextStore };
