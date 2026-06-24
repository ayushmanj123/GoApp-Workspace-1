export interface RuntimeFormUpdatesStore {
  set(formName: string, updates: Record<string, unknown>): void;
  updateField(formName: string, field: string, value: unknown): void;
  get(formName: string): Record<string, unknown>;
  getAll(): Record<string, { Updates: Record<string, unknown> }>;
  clear(): void;
  subscribe(listener: () => void): () => void;
}

export class InMemoryFormUpdatesStore implements RuntimeFormUpdatesStore {
  private updates: Record<string, Record<string, unknown>> = {};
  private readonly listeners = new Set<() => void>();

  set(formName: string, next: Record<string, unknown>): void {
    this.updates[formName] = { ...next };
    for (const fn of this.listeners) fn();
  }

  updateField(formName: string, field: string, value: unknown): void {
    if (!this.updates[formName]) {
      this.updates[formName] = {};
    }
    this.updates[formName] = { ...this.updates[formName], [field]: value };
    for (const fn of this.listeners) fn();
  }

  get(formName: string): Record<string, unknown> {
    return { ...(this.updates[formName] ?? {}) };
  }

  getAll(): Record<string, { Updates: Record<string, unknown> }> {
    const out: Record<string, { Updates: Record<string, unknown> }> = {};
    for (const [name, record] of Object.entries(this.updates)) {
      out[name] = { Updates: { ...record } };
    }
    return out;
  }

  clear(): void {
    if (Object.keys(this.updates).length === 0) return;
    this.updates = {};
    for (const fn of this.listeners) fn();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const defaultFormUpdatesStore: RuntimeFormUpdatesStore =
  new InMemoryFormUpdatesStore();
