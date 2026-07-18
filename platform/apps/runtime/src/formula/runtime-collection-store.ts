export interface RuntimeCollectionStore {
  get(name: string): unknown[];
  collect(name: string, item: unknown): void;
  clearCollect(name: string, items: unknown[]): void;
  replaceAll(collections: Record<string, unknown[]>): void;
  getAll(): Record<string, unknown[]>;
  subscribe(listener: () => void): () => void;
}

export class InMemoryCollectionStore implements RuntimeCollectionStore {
  private collections: Record<string, unknown[]> = {};
  private readonly listeners = new Set<() => void>();

  get(name: string): unknown[] {
    return this.collections[name] ?? [];
  }

  collect(name: string, item: unknown): void {
    if (!this.collections[name]) {
      this.collections[name] = [];
    }
    this.collections[name].push(item);
    for (const fn of this.listeners) fn();
  }

  clearCollect(name: string, items: unknown[]): void {
    this.collections[name] = [...items];
    for (const fn of this.listeners) fn();
  }

  replaceAll(collections: Record<string, unknown[]>): void {
    this.collections = {};
    for (const [name, items] of Object.entries(collections)) {
      this.collections[name] = [...items];
    }
    for (const fn of this.listeners) fn();
  }

  getAll(): Record<string, unknown[]> {
    return { ...this.collections };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const defaultCollectionStore: RuntimeCollectionStore =
  new InMemoryCollectionStore();
