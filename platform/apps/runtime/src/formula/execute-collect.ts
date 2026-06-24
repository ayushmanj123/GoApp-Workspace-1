import type { RuntimeCollectionStore } from "./runtime-collection-store";

export interface ParsedCollect {
  collectionName: string;
  item: Record<string, unknown>;
}

function findFirstTopLevelComma(s: string): number {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
    } else if (c === "(") {
      depth++;
    } else if (c === ")") {
      depth--;
    } else if (c === "{" || c === "[") {
      depth++;
    } else if (c === "}" || c === "]") {
      depth--;
    } else if (c === "," && depth === 0) {
      return i;
    }
  }
  return -1;
}

function parseRecordObject(objectLiteral: string): Record<string, unknown> | null {
  const trimmed = objectLiteral.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;

  const body = trimmed.slice(1, -1).trim();
  if (!body) return {};

  const record: Record<string, unknown> = {};
  let index = 0;

  while (index < body.length) {
    const rest = body.slice(index);
    const stringMatch = rest.match(
      /^\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*"((?:[^"]|"")*)"\s*(?:,\s*)?/,
    );
    if (stringMatch) {
      record[stringMatch[1]] = stringMatch[2].replace(/""/g, '"');
      index += stringMatch[0].length;
      continue;
    }

    const boolMatch = rest.match(
      /^\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*(true|false)\s*(?:,\s*)?/i,
    );
    if (boolMatch) {
      record[boolMatch[1]] = boolMatch[2].toLowerCase() === "true";
      index += boolMatch[0].length;
      continue;
    }

    const numberMatch = rest.match(
      /^\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*(-?\d+(?:\.\d+)?)\s*(?:,\s*)?/,
    );
    if (numberMatch) {
      record[numberMatch[1]] = Number(numberMatch[2]);
      index += numberMatch[0].length;
      continue;
    }

    return null;
  }

  return record;
}

/**
 * Parses Collect(CollectionName, { Property: "Value" }).
 * Flat record with string, number, or boolean literal values only.
 */
export function parseCollectFormula(formula: string): ParsedCollect | null {
  const trimmed = formula.trim();
  if (!/^Collect\s*\(/i.test(trimmed)) return null;

  const openParen = trimmed.indexOf("(");
  const lastParen = trimmed.lastIndexOf(")");
  if (openParen === -1 || lastParen <= openParen) return null;

  const content = trimmed.slice(openParen + 1, lastParen).trim();
  const commaIdx = findFirstTopLevelComma(content);
  if (commaIdx === -1) return null;

  const collectionName = content.slice(0, commaIdx).trim();
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(collectionName)) return null;

  const objectLiteral = content.slice(commaIdx + 1).trim();
  const item = parseRecordObject(objectLiteral);
  if (!item) return null;

  return { collectionName, item };
}

/**
 * Parses ClearCollect(CollectionName, { Property: "Value" }).
 */
export function parseClearCollectFormula(formula: string): ParsedCollect | null {
  const trimmed = formula.trim();
  if (!/^ClearCollect\s*\(/i.test(trimmed)) return null;

  const openParen = trimmed.indexOf("(");
  const lastParen = trimmed.lastIndexOf(")");
  if (openParen === -1 || lastParen <= openParen) return null;

  const content = trimmed.slice(openParen + 1, lastParen).trim();
  const commaIdx = findFirstTopLevelComma(content);
  if (commaIdx === -1) return null;

  const collectionName = content.slice(0, commaIdx).trim();
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(collectionName)) return null;

  const objectLiteral = content.slice(commaIdx + 1).trim();
  const item = parseRecordObject(objectLiteral);
  if (!item) return null;

  return { collectionName, item };
}

export function executeCollect(
  formula: string,
  store: RuntimeCollectionStore,
): void {
  const parsed = parseCollectFormula(formula);
  if (!parsed) {
    throw new Error(`Invalid Collect() formula: ${formula}`);
  }
  store.collect(parsed.collectionName, parsed.item);
}

export function executeClearCollect(
  formula: string,
  store: RuntimeCollectionStore,
): void {
  const parsed = parseClearCollectFormula(formula);
  if (!parsed) {
    throw new Error(`Invalid ClearCollect() formula: ${formula}`);
  }
  store.clearCollect(parsed.collectionName, [parsed.item]);
}
