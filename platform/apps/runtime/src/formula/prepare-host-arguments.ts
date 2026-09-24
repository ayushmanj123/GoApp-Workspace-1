import { createDefaultFormulaEngine } from "@goapps/formula";

/** Argument indexes whose expressions should be reduced by Power Fx before the host runs. */
const PURE_ARGUMENTS: Record<string, number[]> = {
  set: [1],
  notify: [0],
  launch: [0],
};

function findFirstTopLevelComma(source: string): number {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (inString) {
      if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === "(" || char === "{" || char === "[") {
      depth++;
    } else if (char === ")" || char === "}" || char === "]") {
      depth--;
    } else if (char === "," && depth === 0) {
      return i;
    }
  }
  return -1;
}

export function splitFormulaStatements(formula: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let start = 0;
  for (let i = 0; i < formula.length; i++) {
    const char = formula[i];
    if (inString) {
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "(" || char === "{" || char === "[") depth++;
    else if (char === ")" || char === "}" || char === "]") depth--;
    else if (char === ";" && depth === 0) {
      const part = formula.slice(start, i).trim();
      if (part) parts.push(part);
      start = i + 1;
    }
  }
  const tail = formula.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function parseCall(formula: string): { name: string; args: string[] } | undefined {
  const trimmed = formula.trim();
  const open = trimmed.indexOf("(");
  const close = trimmed.lastIndexOf(")");
  if (open <= 0 || close <= open || close !== trimmed.length - 1) return undefined;
  const name = trimmed.slice(0, open).trim();
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) return undefined;
  const content = trimmed.slice(open + 1, close).trim();
  if (!content) return { name, args: [] };
  const args: string[] = [];
  let rest = content;
  while (rest.length > 0) {
    const comma = findFirstTopLevelComma(rest);
    if (comma === -1) {
      args.push(rest.trim());
      break;
    }
    args.push(rest.slice(0, comma).trim());
    rest = rest.slice(comma + 1).trim();
  }
  return { name, args };
}

function isLiteral(expression: string): boolean {
  const trimmed = expression.trim();
  return (
    trimmed === "true" ||
    trimmed === "false" ||
    /^-?\d+(\.\d+)?$/.test(trimmed) ||
    /^"(?:[^"]|"")*"$/.test(trimmed)
  );
}

function toLiteral(value: unknown): string | undefined {
  if (typeof value === "string") return `"${value.replace(/"/g, '""')}"`;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return undefined;
}

async function evalPure(
  expression: string,
  context: Record<string, unknown> | undefined,
): Promise<unknown> {
  const engine = createDefaultFormulaEngine();
  await engine.initialize();
  return engine.evaluate(expression, context);
}

async function rewriteStatement(
  statement: string,
  context: Record<string, unknown> | undefined,
): Promise<string> {
  const parsed = parseCall(statement);
  if (!parsed) return statement;
  const indexes = PURE_ARGUMENTS[parsed.name.toLowerCase()];
  if (!indexes) return statement;
  let changed = false;
  for (const index of indexes) {
    const arg = parsed.args[index];
    if (!arg || isLiteral(arg)) continue;
    try {
      const literal = toLiteral(await evalPure(arg, context));
      if (literal) {
        parsed.args[index] = literal;
        changed = true;
      }
    } catch {
      /* Leave the original argument for the host. */
    }
  }
  if (!changed) return statement;
  return `${parsed.name}(${parsed.args.join(", ")})`;
}

/**
 * Reduces pure arguments such as `Set(x, Sum(1, 2))` to literals before a
 * host function runs. Behavior names themselves stay intact.
 */
export async function prepareHostArguments(
  formula: string,
  context?: Record<string, unknown>,
): Promise<string> {
  const statements = splitFormulaStatements(formula);
  const prepared: string[] = [];
  for (const statement of statements) {
    prepared.push(await rewriteStatement(statement, context));
  }
  return prepared.join("; ");
}

const CLIENT_HOSTS = new Set(["notify", "reset", "select", "launch"]);

export function isClientHostStatement(formula: string): boolean {
  const parsed = parseCall(formula.trim());
  return Boolean(parsed && CLIENT_HOSTS.has(parsed.name.toLowerCase()));
}
