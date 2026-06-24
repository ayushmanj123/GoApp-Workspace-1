export interface RuntimeNavigationStore {
  getCurrentScreenId(): string | undefined;
  navigate(screenId: string): void;
  subscribe(listener: () => void): () => void;
}

export class InMemoryNavigationStore implements RuntimeNavigationStore {
  private currentScreenId?: string;
  private readonly listeners = new Set<() => void>();

  getCurrentScreenId(): string | undefined {
    return this.currentScreenId;
  }

  navigate(screenId: string): void {
    this.currentScreenId = screenId;
    for (const fn of this.listeners) fn();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
