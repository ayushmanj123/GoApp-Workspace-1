import React, { useContext, useEffect, useState } from "react";
import ControlRenderer from "../control-renderer";
import { relativeContainerStyle } from "../utils/control-layout";
import type { ControlPackage } from "../runtime-types";
import {
  ComponentScopeProvider,
  FormulaEvaluationContext,
  useFormulaEngine,
} from "../formula/formula-context";
import {
  componentOutputStore,
  readComponentContract,
  type ComponentContractProperty,
} from "../formula/component-scope";
import { evaluateDisplayFormula } from "../formula/evaluate-display-formula";

export const Component: React.FC<{
  name?: string;
  children?: React.ReactNode;
  templateControls?: ControlPackage[];
  componentContract?: unknown;
  instanceProperties?: Record<string, unknown>;
}> = ({
  name,
  children,
  templateControls = [],
  componentContract,
  instanceProperties,
}) => {
  const contract = readComponentContract(
    componentContract
      ? { component_contract: componentContract }
      : instanceProperties,
  );
  const scope = useComponentInputScope(contract, instanceProperties);
  useComponentOutputs(name, contract, scope);

  const body = templateControls.length > 0
    ? templateControls.map((control) => (
      <ControlRenderer key={control.id} control={control} nested />
    ))
    : children;

  return (
    <ComponentScopeProvider value={scope}>
      <div data-testid="runtime-component-instance" style={relativeContainerStyle()}>
        {body}
      </div>
    </ComponentScopeProvider>
  );
};

function useComponentInputScope(
  contract: ComponentContractProperty[],
  instanceProperties: Record<string, unknown> | undefined,
) {
  const base = useContext(FormulaEvaluationContext);
  const engine = useFormulaEngine();
  const [scope, setScope] = useState<Record<string, unknown>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, unknown> = {};
      for (const property of contract) {
        if (property.direction === "output") continue;
        const raw = instanceProperties?.[property.name];
        if (raw && typeof raw === "object" && "formula" in raw) {
          const formula = String((raw as { formula?: unknown }).formula ?? "").trim();
          if (!formula) continue;
          if (property.direction === "action") {
            next[property.name] = formula;
            continue;
          }
          try {
            next[property.name] = await evaluateDisplayFormula(formula, base, engine);
          } catch {
            next[property.name] = null;
          }
          continue;
        }
        if (raw && typeof raw === "object" && "value" in raw) {
          next[property.name] = (raw as { value?: unknown }).value;
        }
      }
      if (!cancelled) setScope(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [base, contract, engine, instanceProperties]);

  return scope;
}

function useComponentOutputs(
  name: string | undefined,
  contract: ComponentContractProperty[],
  scope: Record<string, unknown>,
) {
  const base = useContext(FormulaEvaluationContext);
  const engine = useFormulaEngine();

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    const context = { ...base, Component: scope };
    void (async () => {
      for (const property of contract) {
        if (property.direction !== "output" || !property.formula?.trim()) continue;
        try {
          const value = await evaluateDisplayFormula(property.formula, context, engine);
          if (!cancelled) componentOutputStore.set(name, property.name, value);
        } catch {
          /* The output stays unset until the inner formula can be evaluated. */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base, contract, engine, name, scope]);
}

export default Component;
