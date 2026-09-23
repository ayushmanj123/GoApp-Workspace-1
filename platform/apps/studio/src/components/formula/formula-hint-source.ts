export interface FormulaHintControl {
  name: string;
  type: string;
}

export interface FormulaHintSnapshot {
  controls: FormulaHintControl[];
  variables: string[];
}

let snapshot: FormulaHintSnapshot = { controls: [], variables: [] };

export function setFormulaHintSnapshot(next: FormulaHintSnapshot): void {
  snapshot = next;
}

export function getFormulaHintSnapshot(): FormulaHintSnapshot {
  return snapshot;
}
