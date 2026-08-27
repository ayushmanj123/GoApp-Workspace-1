type FlushFn = () => Promise<void>;

const flushers = new Map<string, FlushFn>();

export function registerFormUpdateFlusher(formKey: string, flush: FlushFn): () => void {
  flushers.set(formKey, flush);
  return () => {
    if (flushers.get(formKey) === flush) {
      flushers.delete(formKey);
    }
  };
}

export async function flushAllFormUpdates(): Promise<void> {
  const tasks = [...flushers.values()].map((flush) => flush());
  await Promise.all(tasks);
}
