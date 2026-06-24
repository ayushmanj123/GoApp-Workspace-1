import React, { useCallback } from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
import {
  useFormulaEngine,
  useFormulaEvaluationContext,
  useVariableStore,
  useScreenContextStore,
} from "../formula/formula-context";
import { executeAction } from "../formula/execute-action";

function readActionFormula(property: unknown): string | null {
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    if (typeof formula === "string" && formula.trim()) {
      return formula.trim();
    }
  }
  return null;
}

export const Button: React.FC<any> = ({
  text = "Button",
  disabled = false,
  onSelect,
  onClick,
}) => {
  const label = useResolvedPropertyText(text, "Button");
  const engine = useFormulaEngine();
  const context = useFormulaEvaluationContext();
  const store = useVariableStore();
  const screenContextStore = useScreenContextStore();

  const handleClick = useCallback(async () => {
    const formula = readActionFormula(onSelect);
    if (formula) {
      try {
        await executeAction(
          { formula },
          { store, screenContextStore, engine, context },
        );
      } catch (err) {
        console.error(err);
      }
    }
    onClick?.();
  }, [onSelect, store, screenContextStore, engine, context, onClick]);

  return (
    <button disabled={disabled} onClick={handleClick}>
      {label}
    </button>
  );
};
export default Button;
