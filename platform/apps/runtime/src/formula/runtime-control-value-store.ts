export interface RuntimeControlValueStore {
  get(controlName: string, field: string): unknown;
  set(controlName: string, field: string, value: unknown): void;
  getSymbols(): Record<string, Record<string, unknown>>;
  clearControl(controlName: string): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
}

export class InMemoryControlValueStore implements RuntimeControlValueStore {
  private values: Record<string, Record<string, unknown>> = {};
  private readonly listeners = new Set<() => void>();

  get(controlName: string, field: string): unknown {
    return this.values[controlName]?.[field];
  }

  set(controlName: string, field: string, value: unknown): void {
    const current = this.values[controlName] ?? {};
    this.values[controlName] = { ...current, [field]: value };
    for (const listener of this.listeners) {
      listener();
    }
  }

  clearControl(controlName: string): void {
    if (!this.values[controlName]) return;
    const next = { ...this.values };
    delete next[controlName];
    this.values = next;
    for (const listener of this.listeners) {
      listener();
    }
  }

  getSymbols(): Record<string, Record<string, unknown>> {
    const symbols: Record<string, Record<string, unknown>> = {};
    for (const [controlName, fields] of Object.entries(this.values)) {
      symbols[controlName] = { ...fields };
    }
    return symbols;
  }

  clear(): void {
    this.values = {};
    for (const listener of this.listeners) {
      listener();
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const defaultControlValueStore = new InMemoryControlValueStore();
