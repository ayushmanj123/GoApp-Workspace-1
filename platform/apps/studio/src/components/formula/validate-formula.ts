export type FormulaValidationMode = "expression" | "action";

export async function validateFormula(
  formula: string,
  options?: {
    mode?: FormulaValidationMode;
    context?: Record<string, unknown>;
  },
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = formula.trim();
  if (!trimmed) {
    return { ok: false, error: "Formula is required." };
  }

  const mode = options?.mode ?? "expression";

  if (mode === "action") {
    const { validateActionFormula } = await import("./validate-action-formula");
    return validateActionFormula(trimmed);
  }

  const baseUrl =
    (import.meta.env.VITE_FORMULA_API_URL as string | undefined)?.replace(/\/$/, "") ??
    "/formula-api";

  try {
    const response = await fetch(`${baseUrl}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formula: trimmed,
        context: options?.context ?? {},
      }),
    });
    if (!response.ok) {
      return { ok: false, error: `Validation request failed (${response.status}).` };
    }
    const body = (await response.json()) as { ok?: boolean; error?: string };
    return { ok: Boolean(body.ok), error: body.error };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Validation failed.",
    };
  }
}

export async function checkFormulaApiHealth(): Promise<boolean> {
  const baseUrl =
    (import.meta.env.VITE_FORMULA_API_URL as string | undefined)?.replace(/\/$/, "") ??
    "/formula-api";

  try {
    const response = await fetch(`${baseUrl}/health`, { method: "GET" });
    if (!response.ok) {
      return false;
    }
    const body = (await response.json()) as { ok?: boolean };
    return Boolean(body.ok);
  } catch {
    return false;
  }
}
