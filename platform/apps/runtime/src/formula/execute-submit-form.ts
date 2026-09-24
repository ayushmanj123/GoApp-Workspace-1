import type { RuntimeFormUpdatesStore } from "./runtime-form-updates-store";
import type { RuntimeRecordStore } from "./runtime-record-store";

export interface ParsedSubmitForm {
  formName: string;
}

export interface SubmitFormControl {
  name?: string;
  control_type?: string;
  properties?: Record<string, unknown> | null;
  children?: SubmitFormControl[];
}

function normalizeControlType(controlType: string): string {
  return controlType.trim().toLowerCase().replace(/_/g, "");
}

export function findFormControlByName(
  controls: SubmitFormControl[],
  formName: string,
): SubmitFormControl | undefined {
  for (const control of controls) {
    if (control.name === formName) {
      return control;
    }
    if (control.children?.length) {
      const nested = findFormControlByName(control.children, formName);
      if (nested) return nested;
    }
  }
  return undefined;
}

/**
 * Parses SubmitForm(FormName).
 */
export function parseSubmitFormFormula(formula: string): ParsedSubmitForm | null {
  const trimmed = formula.trim();
  if (!/^SubmitForm\s*\(/i.test(trimmed)) return null;

  const openParen = trimmed.indexOf("(");
  const lastParen = trimmed.lastIndexOf(")");
  if (openParen === -1 || lastParen <= openParen) return null;

  const formName = trimmed.slice(openParen + 1, lastParen).trim();
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(formName)) return null;

  return { formName };
}

/**
 * Executes SubmitForm(FormName) by appending Form.Updates to RuntimeRecordStore.
 *
 * Gated to no-session / offline paths only. When a runtime session exists,
 * use-runtime-action-handler must call executeRuntimeAction (Go Form Service)
 * instead — this in-memory path must never shadow session SubmitForm.
 */
export function executeSubmitForm(
  formula: string,
  formUpdatesStore: RuntimeFormUpdatesStore,
  recordStore: RuntimeRecordStore,
  controls: SubmitFormControl[],
): void {
  const parsed = parseSubmitFormFormula(formula);
  if (!parsed) {
    throw new Error(`Invalid SubmitForm() formula: ${formula}`);
  }

  const formControl = findFormControlByName(controls, parsed.formName);
  if (
    !formControl ||
    normalizeControlType(formControl.control_type ?? "") !== "form"
  ) {
    throw new Error(`[Action Error]: form not found: ${parsed.formName}`);
  }

  const updates = formUpdatesStore.get(parsed.formName);
  recordStore.submit(parsed.formName, updates);
}
