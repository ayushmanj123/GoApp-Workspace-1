export interface RuntimeScreenContextStore {
  get(name: string): unknown;
  set(name: string, value: unknown): void;
  getAll(): Record<string, unknown>;
  clear(): void;
  subscribe(listener: () => void): () => void;
}

export class InMemoryScreenContextStore implements RuntimeScreenContextStore {
  private context: Record<string, unknown>;
  private readonly listeners = new Set<() => void>();

  constructor(initial?: Record<string, unknown>) {
    this.context = initial ?? {};
  }

  get(name: string): unknown {
    return this.context[name];
  }

  set(name: string, value: unknown): void {
    this.context[name] = value;
    for (const fn of this.listeners) fn();
  }

  getAll(): Record<string, unknown> {
    return { ...this.context };
  }

  clear(): void {
    this.context = {};
    for (const fn of this.listeners) fn();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const defaultScreenContextStore: RuntimeScreenContextStore =
  new InMemoryScreenContextStore();
