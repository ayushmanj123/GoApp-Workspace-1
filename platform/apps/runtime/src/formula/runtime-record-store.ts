export interface RuntimeRecordStore {
  submit(formName: string, record: Record<string, unknown>): void;
  getRecords(formName: string): Record<string, unknown>[];
  clear(): void;
  subscribe(listener: () => void): () => void;
}

export class InMemoryRecordStore implements RuntimeRecordStore {
  private records: Record<string, Record<string, unknown>[]> = {};
  private readonly listeners = new Set<() => void>();

  submit(formName: string, record: Record<string, unknown>): void {
    if (!this.records[formName]) {
      this.records[formName] = [];
    }
    this.records[formName].push({ ...record });
    for (const fn of this.listeners) fn();
  }

  getRecords(formName: string): Record<string, unknown>[] {
    return (this.records[formName] ?? []).map((record) => ({ ...record }));
  }

  clear(): void {
    if (Object.keys(this.records).length === 0) return;
    this.records = {};
    for (const fn of this.listeners) fn();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const defaultRecordStore: RuntimeRecordStore = new InMemoryRecordStore();
