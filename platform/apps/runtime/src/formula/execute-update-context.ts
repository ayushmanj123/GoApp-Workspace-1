import type { RuntimeScreenContextStore } from "./runtime-screen-context-store";

export interface ParsedUpdateContext {
  key: string;
  value: string;
}

/**
 * Parses UpdateContext({ key: "literal" }) with a single string literal value.
 * Returns null for invalid or unsupported shapes.
 */
export function parseUpdateContextFormula(formula: string): ParsedUpdateContext | null {
  const trimmed = formula.trim();
  if (!/^UpdateContext\s*\(/i.test(trimmed)) return null;

  const openParen = trimmed.indexOf("(");
  const lastParen = trimmed.lastIndexOf(")");
  if (openParen === -1 || lastParen <= openParen) return null;

  const objectLiteral = trimmed.slice(openParen + 1, lastParen).trim();
  const match = objectLiteral.match(
    /^\{\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*"((?:[^"]|"")*)"\s*\}$/,
  );
  if (!match) return null;

  return {
    key: match[1],
    value: match[2].replace(/""/g, '"'),
  };
}

/**
 * Executes UpdateContext({ key: "value" }) by writing to the screen context store.
 */
export function executeUpdateContext(
  formula: string,
  store: RuntimeScreenContextStore,
): void {
  const parsed = parseUpdateContextFormula(formula);
  if (!parsed) {
    throw new Error(`Invalid UpdateContext() formula: ${formula}`);
  }
  store.set(parsed.key, parsed.value);
}
