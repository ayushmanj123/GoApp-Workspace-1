export interface RuntimeVariableStore {
  get(name: string): unknown;
  set(name: string, value: unknown): void;
  getAll(): Record<string, unknown>;
  subscribe(listener: () => void): () => void;
}

export class InMemoryVariableStore implements RuntimeVariableStore {
  private variables: Record<string, unknown>;
  private readonly listeners = new Set<() => void>();

  constructor(initial?: Record<string, unknown>) {
    this.variables = initial ?? {
      varTitle: "Hello World",
      varCount: 10,
      varStatus: "Approved",
    };
  }

  get(name: string): unknown {
    return this.variables[name];
  }

  set(name: string, value: unknown): void {
    this.variables[name] = value;
    for (const fn of this.listeners) fn();
  }

  getAll(): Record<string, unknown> {
    return { ...this.variables };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const defaultVariableStore: RuntimeVariableStore =
  new InMemoryVariableStore();
