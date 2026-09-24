import { getFormulaApiUrl } from "@goapps/formula";

/** Used when the formula service has not published its catalog yet. */
export const FORMULA_SUGGESTIONS = [
  "Set",
  "UpdateContext",
  "Navigate",
  "Collect",
  "ClearCollect",
  "Clear",
  "Patch",
  "Remove",
  "Defaults",
  "CountRows",
  "First",
  "Last",
  "LookUp",
  "Filter",
  "IsEmpty",
  "Upper",
  "Lower",
  "Len",
  "Concatenate",
  "If",
  "SubmitForm",
  "ResetForm",
  "NewForm",
  "EditForm",
  "ViewForm",
  "Back",
  "Notify",
  "Reset",
  "Select",
  "Launch",
  "Sort",
  "SortByColumns",
  "Search",
  "ForAll",
  "User",
  "App",
  "ThisItem",
  "Parent",
] as const;

let liveSuggestions: readonly string[] = FORMULA_SUGGESTIONS;

/** Function names for the editor. Updates after the formula service catalog loads. */
export function getFormulaSuggestions(): readonly string[] {
  return liveSuggestions;
}

export async function refreshFormulaSuggestions(): Promise<void> {
  try {
    const baseUrl = getFormulaApiUrl();
    if (!baseUrl) return;
    const response = await fetch(`${baseUrl}/functions`);
    if (!response.ok) return;
    const body = (await response.json()) as { functions?: unknown };
    if (!Array.isArray(body.functions)) return;
    const names = body.functions.filter((item): item is string => typeof item === "string" && item.trim() !== "");
    if (names.length > 0) {
      liveSuggestions = names;
    }
  } catch {
    /* Keep the built-in list when the formula service is unreachable. */
  }
}
