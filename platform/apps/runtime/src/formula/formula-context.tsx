import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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

const FormulaContext = createContext<FormulaEngine | null>(null);
const FormulaEvaluationContext = createContext<Record<string, unknown>>(
  buildFormulaRuntimeContext(),
);

interface FormulaProviderProps {
  engine?: FormulaEngine;
  appName?: string;
  controls?: FormulaControlContextInput[];
  children: ReactNode;
}

export function FormulaProvider({
  engine,
  appName,
  controls = [],
  children,
}: FormulaProviderProps) {
  const formulaEngine = useMemo(
    () => engine ?? createDefaultFormulaEngine(),
    [engine],
  );
  const evaluationContext = useMemo(
    () => buildFormulaRuntimeContext(appName, controls),
    [appName, controls],
  );

  useEffect(() => {
    void formulaEngine.initialize();
  }, [formulaEngine]);

  return (
    <FormulaContext.Provider value={formulaEngine}>
      <FormulaEvaluationContext.Provider value={evaluationContext}>
        {children}
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

export { HARDCODED_USER, buildFormulaRuntimeContext };
