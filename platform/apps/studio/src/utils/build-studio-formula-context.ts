import type { FormulaControlContextInput } from "@goapps/formula";
import { buildFormulaRuntimeContext } from "../../../runtime/src/formula/formula-runtime-context";
import { defaultVariableStore } from "../../../runtime/src/formula/runtime-variable-store";
import type { Control } from "../api/controls-api";

export function buildStudioFormulaContext(
  appName: string,
  controls: Control[],
): Record<string, unknown> {
  const formulaControls: FormulaControlContextInput[] = controls.map((control) => ({
    name: control.name,
    control_type: control.control_type,
    properties: control.properties,
    x: control.x,
    y: control.y,
    width: control.width,
    height: control.height,
  }));

  return buildFormulaRuntimeContext(
    appName,
    formulaControls,
    defaultVariableStore,
  );
}
