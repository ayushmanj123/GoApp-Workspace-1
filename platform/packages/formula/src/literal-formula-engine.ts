import type { FormulaEngine } from "./formula-engine.js";

const STRING_LITERAL = /^"((?:[^"]|"")*)"$/;
const NUMBER_LITERAL = /^-?\d+(\.\d+)?$/;

function parseStringLiteral(source: string): string {
  const match = source.match(STRING_LITERAL);
  if (!match) {
    throw new Error(`Invalid string literal: ${source}`);
  }
  return match[1].replace(/""/g, '"');
}

function readContextPath(
  context: Record<string, unknown> | undefined,
  path: string,
): unknown {
  if (!context) {
    throw new Error(`Unsupported literal formula: ${path}`);
  }

  const parts = path.split(".");
  let current: unknown = context;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      throw new Error(`Unknown context property: ${path}`);
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export class LiteralFormulaEngine implements FormulaEngine {
  private initialized = false;

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async evaluate(
    formula: string,
    context?: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.initialized) {
      await this.initialize();
    }

    const expression = formula.trim();
    if (!expression) {
      throw new Error("Formula is empty.");
    }

    if (expression === "true") {
      return true;
    }
    if (expression === "false") {
      return false;
    }
    if (NUMBER_LITERAL.test(expression)) {
      return Number(expression);
    }
    if (expression.startsWith('"')) {
      return parseStringLiteral(expression);
    }

    if (/^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)+$/.test(expression)) {
      return readContextPath(context, expression);
    }

    throw new Error(`Unsupported literal formula: ${formula}`);
  }
}
