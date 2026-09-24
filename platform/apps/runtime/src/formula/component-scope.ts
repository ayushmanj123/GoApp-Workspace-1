export interface ComponentContractProperty {
  name: string;
  direction: "input" | "output" | "action";
  dataType: "text" | "number" | "boolean" | "color" | "record" | "table";
  formula?: string;
}

const listeners = new Set<() => void>();
const outputs: Record<string, Record<string, unknown>> = {};

export const componentOutputStore = {
  getAll(): Record<string, Record<string, unknown>> {
    return outputs;
  },
  set(instanceName: string, field: string, value: unknown): void {
    const previous = outputs[instanceName]?.[field];
    if (Object.is(previous, value)) return;
    if (
      previous &&
      value &&
      typeof previous === "object" &&
      typeof value === "object" &&
      JSON.stringify(previous) === JSON.stringify(value)
    ) {
      return;
    }
    outputs[instanceName] = { ...(outputs[instanceName] ?? {}), [field]: value };
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function readComponentContract(properties: Record<string, unknown> | null | undefined): ComponentContractProperty[] {
  const raw = properties?.component_contract;
  const value = raw && typeof raw === "object" && "value" in raw
    ? (raw as { value?: unknown }).value
    : raw;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { name?: unknown; direction?: unknown; dataType?: unknown; formula?: unknown };
    if (typeof record.name !== "string" || !record.name.trim()) return [];
    const direction = record.direction === "output" || record.direction === "action" ? record.direction : "input";
    const dataType = record.dataType === "number"
      || record.dataType === "boolean"
      || record.dataType === "color"
      || record.dataType === "record"
      || record.dataType === "table"
      ? record.dataType
      : "text";
    return [{
      name: record.name,
      direction,
      dataType,
      formula: typeof record.formula === "string" ? record.formula : undefined,
    }];
  });
}

export function componentScopeDefaults(
  properties: ComponentContractProperty[],
): Record<string, unknown> {
  const scope: Record<string, unknown> = {};
  for (const property of properties) {
    if (property.direction !== "input") continue;
    if (property.dataType === "table") scope[property.name] = [];
    else if (property.dataType === "record") scope[property.name] = {};
    else if (property.dataType === "number") scope[property.name] = 0;
    else if (property.dataType === "boolean") scope[property.name] = false;
    else scope[property.name] = "";
  }
  return scope;
}

export function mergeComponentOutputs(
  context: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...context };
  for (const [name, fields] of Object.entries(outputs)) {
    const existing = next[name];
    next[name] = {
      ...(existing && typeof existing === "object" && !Array.isArray(existing)
        ? existing as Record<string, unknown>
        : {}),
      ...fields,
    };
  }
  return next;
}
