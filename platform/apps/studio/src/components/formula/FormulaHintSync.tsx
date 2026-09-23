import { useEffect, useState } from "react";
import { defaultVariableStore } from "../../../../runtime/src/formula/runtime-variable-store";
import { useApplicationStore } from "../../store/applicationStore";
import { setFormulaHintSnapshot } from "./formula-hint-source";

/** Keeps Monaco completion in sync with controls and variables. */
export function FormulaHintSync() {
  const controls = useApplicationStore((state) => state.controls);
  const [tick, setTick] = useState(0);

  useEffect(() => defaultVariableStore.subscribe(() => setTick((value) => value + 1)), []);

  useEffect(() => {
    setFormulaHintSnapshot({
      controls: controls
        .filter((control) => control.name.trim())
        .map((control) => ({ name: control.name, type: control.control_type })),
      variables: Object.keys(defaultVariableStore.getAll()),
    });
  }, [controls, tick]);

  return null;
}
