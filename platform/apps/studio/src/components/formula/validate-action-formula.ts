import { parseClearCollectFormula, parseCollectFormula } from "../../../../runtime/src/formula/execute-collect";
import { parseNavigateFormula } from "../../../../runtime/src/formula/execute-navigate";
import { parseSetFormula } from "../../../../runtime/src/formula/execute-set";
import { parseSubmitFormFormula } from "../../../../runtime/src/formula/execute-submit-form";
import { parseUpdateContextFormula } from "../../../../runtime/src/formula/execute-update-context";

export function validateActionFormula(
  formula: string,
): { ok: boolean; error?: string } {
  const trimmed = formula.trim();
  if (!trimmed) {
    return { ok: false, error: "Formula is required." };
  }

  if (parseSetFormula(trimmed)) {
    return { ok: true };
  }
  if (parseUpdateContextFormula(trimmed)) {
    return { ok: true };
  }
  if (parseNavigateFormula(trimmed)) {
    return { ok: true };
  }
  if (parseCollectFormula(trimmed)) {
    return { ok: true };
  }
  if (parseClearCollectFormula(trimmed)) {
    return { ok: true };
  }
  if (parseSubmitFormFormula(trimmed)) {
    return { ok: true };
  }

  return {
    ok: false,
    error: "Unsupported action. Use Set, UpdateContext, Navigate, Collect, ClearCollect, or SubmitForm.",
  };
}
