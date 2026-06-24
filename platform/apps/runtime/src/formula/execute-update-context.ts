import type { RuntimeScreenContextStore } from "./runtime-screen-context-store";

export interface ParsedUpdateContext {
  fields: Record<string, string>;
}

function parseUpdateContextObject(
  objectLiteral: string,
): Record<string, string> | null {
  const trimmed = objectLiteral.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;

  const body = trimmed.slice(1, -1).trim();
  if (!body) return {};

  const record: Record<string, string> = {};
  let index = 0;

  while (index < body.length) {
    const rest = body.slice(index);
    const match = rest.match(
      /^\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*"((?:[^"]|"")*)"\s*(?:,\s*)?/,
    );
    if (!match) return null;

    record[match[1]] = match[2].replace(/""/g, '"');
    index += match[0].length;
  }

  return record;
}

/**
 * Parses UpdateContext({ key: "literal", ... }) with string literal values.
 * Returns null for invalid or unsupported shapes.
 */
export function parseUpdateContextFormula(
  formula: string,
): ParsedUpdateContext | null {
  const trimmed = formula.trim();
  if (!/^UpdateContext\s*\(/i.test(trimmed)) return null;

  const openParen = trimmed.indexOf("(");
  const lastParen = trimmed.lastIndexOf(")");
  if (openParen === -1 || lastParen <= openParen) return null;

  const objectLiteral = trimmed.slice(openParen + 1, lastParen).trim();
  const fields = parseUpdateContextObject(objectLiteral);
  if (!fields) return null;

  return { fields };
}

/**
 * Executes UpdateContext({ key: "value", ... }) by writing to the screen context store.
 */
export function executeUpdateContext(
  formula: string,
  store: RuntimeScreenContextStore,
): void {
  const parsed = parseUpdateContextFormula(formula);
  if (!parsed) {
    throw new Error(`Invalid UpdateContext() formula: ${formula}`);
  }
  for (const [key, value] of Object.entries(parsed.fields)) {
    store.set(key, value);
  }
}
