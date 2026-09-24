import type { ActionServices } from "./execute-action";
import { findFormControlByName } from "./execute-submit-form";
import { executeNavigate } from "./execute-navigate";

function callContent(formula: string): { name: string; content: string } | undefined {
  const trimmed = formula.trim();
  const open = trimmed.indexOf("(");
  const close = trimmed.lastIndexOf(")");
  if (open <= 0 || close <= open) return undefined;
  return {
    name: trimmed.slice(0, open).trim(),
    content: trimmed.slice(open + 1, close).trim(),
  };
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed;
}

function splitArgs(content: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let inString = false;
  let start = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (inString) {
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "(" || char === "{" || char === "[") depth++;
    else if (char === ")" || char === "}" || char === "]") depth--;
    else if (char === "," && depth === 0) {
      args.push(content.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = content.slice(start).trim();
  if (tail) args.push(tail);
  return args;
}

function fieldValue(item: unknown, field: string): unknown {
  if (!item || typeof item !== "object") return undefined;
  const record = item as Record<string, unknown>;
  if (field in record) return record[field];
  const match = Object.keys(record).find((key) => key.toLowerCase() === field.toLowerCase());
  return match ? record[match] : undefined;
}

function compareValues(left: unknown, right: unknown): number {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (left !== "" && right !== "" && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return String(left ?? "").localeCompare(String(right ?? ""));
}

function readOnSelect(control: { properties?: Record<string, unknown> | null }): string {
  const raw = control.properties?.onSelect ?? control.properties?.OnSelect;
  if (raw && typeof raw === "object" && "formula" in raw) {
    const formula = (raw as { formula?: unknown }).formula;
    return typeof formula === "string" ? formula.trim() : "";
  }
  return "";
}

export async function executeClientHost(
  formula: string,
  services: ActionServices,
): Promise<void> {
  const parsed = callContent(formula);
  if (!parsed) {
    throw new Error(`[Action Error]: unsupported action: ${formula}`);
  }
  const name = parsed.name.toLowerCase();
  const args = splitArgs(parsed.content);

  if (name === "notify") {
    const message = unquote(args[0] ?? "");
    services.notify?.(message);
    return;
  }

  if (name === "reset") {
    const controlName = unquote(args[0] ?? "");
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(controlName)) {
      throw new Error(`[Action Error]: invalid Reset() target: ${formula}`);
    }
    services.controlValueStore?.clearControl(controlName);
    return;
  }

  if (name === "select") {
    const controlName = unquote(args[0] ?? "");
    const control = findFormControlByName(services.controls, controlName);
    const onSelect = control ? readOnSelect(control) : "";
    if (!onSelect) {
      throw new Error(`[Action Error]: ${controlName} has no OnSelect`);
    }
    if (!services.runFormula) {
      throw new Error("[Action Error]: Select() cannot run OnSelect");
    }
    await services.runFormula(onSelect);
    return;
  }

  if (name === "launch") {
    const target = unquote(args[0] ?? "");
    if (/^https?:\/\//i.test(target)) {
      if (typeof window !== "undefined") {
        window.open(target, "_blank", "noopener,noreferrer");
      }
      return;
    }
    executeNavigate(
      `Navigate(${target})`,
      services.navigationStore,
      services.resolveScreenId,
      services.screenContextStore,
      services.gallerySelectionStore,
    );
    return;
  }

  if (name === "sort" || name === "sortbycolumns") {
    const collection = args[0];
    const field = unquote(args[1] ?? "");
    const descending = /desc/i.test(args[2] ?? "");
    const items = [...services.collectionStore.get(collection)];
    items.sort((left, right) => {
      const order = compareValues(fieldValue(left, field), fieldValue(right, field));
      return descending ? -order : order;
    });
    services.collectionStore.clearCollect(collection, items);
    return;
  }

  if (name === "search") {
    const collection = args[0];
    const text = unquote(args[1] ?? "").toLowerCase();
    const field = unquote(args[2] ?? "");
    const items = services.collectionStore
      .get(collection)
      .filter((item) => String(fieldValue(item, field) ?? "").toLowerCase().includes(text));
    services.collectionStore.clearCollect(collection, items);
    return;
  }

  if (name === "forall") {
    const collection = args[0];
    const body = args.slice(1).join(", ");
    if (!body || !services.runFormula) {
      throw new Error(`[Action Error]: invalid ForAll() formula: ${formula}`);
    }
    const rows = [...services.collectionStore.get(collection)];
    for (const row of rows) {
      const record = row && typeof row === "object" ? (row as Record<string, unknown>) : { Value: row };
      const previousRecord = services.context.ThisRecord;
      const previousItem = services.context.ThisItem;
      services.context.ThisRecord = record;
      services.context.ThisItem = record;
      try {
        await services.runFormula(body);
      } finally {
        services.context.ThisRecord = previousRecord;
        services.context.ThisItem = previousItem;
      }
    }
    return;
  }

  throw new Error(`[Action Error]: unsupported action: ${formula}`);
}
