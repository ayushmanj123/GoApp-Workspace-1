export interface RuntimeGallerySelectionStore {
  select(galleryName: string, record: Record<string, unknown>): void;
  get(galleryName: string): Record<string, unknown> | undefined;
  getAll(): Record<string, { Selected: Record<string, unknown> }>;
  clear(): void;
  subscribe(listener: () => void): () => void;
}

export class InMemoryGallerySelectionStore implements RuntimeGallerySelectionStore {
  private selections: Record<string, Record<string, unknown>> = {};
  private readonly listeners = new Set<() => void>();

  select(galleryName: string, record: Record<string, unknown>): void {
    this.selections[galleryName] = { ...record };
    for (const fn of this.listeners) fn();
  }

  get(galleryName: string): Record<string, unknown> | undefined {
    const record = this.selections[galleryName];
    return record ? { ...record } : undefined;
  }

  getAll(): Record<string, { Selected: Record<string, unknown> }> {
    const out: Record<string, { Selected: Record<string, unknown> }> = {};
    for (const [name, record] of Object.entries(this.selections)) {
      out[name] = { Selected: { ...record } };
    }
    return out;
  }

  clear(): void {
    if (Object.keys(this.selections).length === 0) return;
    this.selections = {};
    for (const fn of this.listeners) fn();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const defaultGallerySelectionStore: RuntimeGallerySelectionStore =
  new InMemoryGallerySelectionStore();
