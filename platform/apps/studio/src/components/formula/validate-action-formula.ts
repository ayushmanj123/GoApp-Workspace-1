/**
 * Studio action-formula validation aligned with the runtime kernel dispatcher.
 * Supports top-level ";" chaining (depth-aware).
 */

import { parseClearCollectFormula, parseCollectFormula } from "../../../../runtime/src/formula/execute-collect";
import { parseNavigateFormula } from "../../../../runtime/src/formula/execute-navigate";
import { parseSetFormula } from "../../../../runtime/src/formula/execute-set";
import { parseSubmitFormFormula } from "../../../../runtime/src/formula/execute-submit-form";
import { parseUpdateContextFormula } from "../../../../runtime/src/formula/execute-update-context";

const ALLOWED_PREFIXES = [
  "SET(",
  "UPDATECONTEXT(",
  "NAVIGATE(",
  "COLLECT(",
  "CLEARCOLLECT(",
  "CLEAR(",
  "PATCH(",
  "REMOVE(",
  "DEFAULTS(",
  "SUBMITFORM(",
  "RESETFORM(",
  "NEWFORM(",
  "EDITFORM(",
  "VIEWFORM(",
  "BACK(",
  "LOOKUP(",
  "FILTER(",
  "FIRST(",
  "LAST(",
  "COUNTROWS(",
] as const;

function splitStatements(formula: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString: '"' | "'" | null = null;
  let start = 0;
  for (let i = 0; i < formula.length; i += 1) {
    const ch = formula[i];
    if (inString) {
      if (ch === "\\" && i + 1 < formula.length) {
        i += 1;
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") {
      depth += 1;
      continue;
    }
    if (ch === ")" || ch === "}" || ch === "]") {
      if (depth > 0) depth -= 1;
      continue;
    }
    if (ch === ";" && depth === 0) {
      const piece = formula.slice(start, i).trim();
      if (piece) parts.push(piece);
      start = i + 1;
    }
  }
  const tail = formula.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function looksLikeCall(formula: string, name: string): boolean {
  const re = new RegExp(`^${name}\\s*\\(`, "i");
  return re.test(formula.trim());
}

function validateSingleStatement(formula: string): { ok: boolean; error?: string } {
  const trimmed = formula.trim();
  if (!trimmed) {
    return { ok: false, error: "Empty statement." };
  }

  if (parseSetFormula(trimmed)) return { ok: true };
  if (parseUpdateContextFormula(trimmed)) return { ok: true };
  if (parseNavigateFormula(trimmed)) return { ok: true };
  if (parseCollectFormula(trimmed)) return { ok: true };
  if (parseClearCollectFormula(trimmed)) return { ok: true };
  if (parseSubmitFormFormula(trimmed)) return { ok: true };

  // Kernel-supported actions: accept well-formed call shape (runtime does deep parse).
  if (
    looksLikeCall(trimmed, "Patch") ||
    looksLikeCall(trimmed, "Remove") ||
    looksLikeCall(trimmed, "Defaults") ||
    looksLikeCall(trimmed, "Clear") ||
    looksLikeCall(trimmed, "ResetForm") ||
    looksLikeCall(trimmed, "NewForm") ||
    looksLikeCall(trimmed, "EditForm") ||
    looksLikeCall(trimmed, "ViewForm") ||
    looksLikeCall(trimmed, "Back") ||
    looksLikeCall(trimmed, "LookUp") ||
    looksLikeCall(trimmed, "Filter") ||
    looksLikeCall(trimmed, "First") ||
    looksLikeCall(trimmed, "Last") ||
    looksLikeCall(trimmed, "CountRows")
  ) {
    if (!trimmed.includes("(") || !trimmed.endsWith(")")) {
      return { ok: false, error: "Malformed function call." };
    }
    return { ok: true };
  }

  const upper = trimmed.toUpperCase();
  const matched = ALLOWED_PREFIXES.some((p) => upper.startsWith(p));
  if (!matched) {
    return {
      ok: false,
      error:
        "Unsupported action. Use Set, UpdateContext, Navigate, Collect, ClearCollect, Clear, Patch, Remove, Defaults, SubmitForm, ResetForm, NewForm, EditForm, ViewForm, Back, LookUp, or Filter (chain with ;).",
    };
  }
  return { ok: true };
}

export function validateActionFormula(
  formula: string,
): { ok: boolean; error?: string } {
  const trimmed = formula.trim();
  if (!trimmed) {
    return { ok: false, error: "Formula is required." };
  }

  const statements = splitStatements(trimmed);
  if (statements.length === 0) {
    return { ok: false, error: "Formula is required." };
  }

  for (const statement of statements) {
    const result = validateSingleStatement(statement);
    if (!result.ok) {
      return result;
    }
  }
  return { ok: true };
}

/** Exported for unit tests. */
export { splitStatements };
