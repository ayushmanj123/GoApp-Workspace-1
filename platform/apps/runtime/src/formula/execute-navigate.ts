import type { RuntimeGallerySelectionStore } from "./runtime-gallery-selection-store";
import type { RuntimeNavigationStore } from "./runtime-navigation-store";
import type { RuntimeScreenContextStore } from "./runtime-screen-context-store";

export interface ParsedNavigate {
  screenName: string;
}

/**
 * Parses Navigate(ScreenName) or Navigate(ScreenName, None).
 * Returns null for unsupported shapes (e.g. context records).
 */
export function parseNavigateFormula(formula: string): ParsedNavigate | null {
  const trimmed = formula.trim();
  if (!/^Navigate\s*\(/i.test(trimmed)) return null;

  const openParen = trimmed.indexOf("(");
  const lastParen = trimmed.lastIndexOf(")");
  if (openParen === -1 || lastParen <= openParen) return null;

  const content = trimmed.slice(openParen + 1, lastParen).trim();
  const match = content.match(/^([A-Za-z][A-Za-z0-9]*)(?:\s*,\s*None)?\s*$/i);
  if (!match) return null;

  return { screenName: match[1] };
}

export function executeNavigate(
  formula: string,
  navigationStore: RuntimeNavigationStore,
  resolveScreenId: (name: string) => string | undefined,
  screenContextStore: RuntimeScreenContextStore,
  gallerySelectionStore?: RuntimeGallerySelectionStore,
): void {
  const parsed = parseNavigateFormula(formula);
  if (!parsed) {
    throw new Error(`Invalid Navigate() formula: ${formula}`);
  }

  const screenId = resolveScreenId(parsed.screenName);
  if (!screenId) {
    throw new Error(`[Action Error]: screen not found: ${parsed.screenName}`);
  }

  screenContextStore.clear();
  gallerySelectionStore?.clear();
  navigationStore.navigate(screenId);
}
