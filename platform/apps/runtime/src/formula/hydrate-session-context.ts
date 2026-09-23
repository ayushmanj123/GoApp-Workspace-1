import {
  evaluateRuntimeFormula,
  fetchRuntimeStateSnapshot,
  type RuntimeStateSnapshot,
} from "../runtime-session-client";
import type { RuntimeCollectionStore } from "./runtime-collection-store";
import type { RuntimeVariableStore } from "./runtime-variable-store";

export interface HydrateSessionContextInput {
  appId: string;
  sessionId: string;
  screen: string;
  entityNames?: string[];
  variableStore: RuntimeVariableStore;
  collectionStore: RuntimeCollectionStore;
}

function hydrateFromSnapshot(
  snapshot: RuntimeStateSnapshot,
  variableStore: RuntimeVariableStore,
  collectionStore: RuntimeCollectionStore,
): void {
  variableStore.replaceAll({
    ...variableStore.getAll(),
    ...(snapshot.globalVariables ?? {}),
  });
  collectionStore.replaceAll(snapshot.collections ?? {});
}

async function hydrateEntityCollections(
  input: HydrateSessionContextInput,
): Promise<void> {
  const names = input.entityNames ?? [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const { result } = await evaluateRuntimeFormula({
        appId: input.appId,
        sessionId: input.sessionId,
        screen: input.screen,
        formula: trimmed,
      });
      if (Array.isArray(result)) {
        input.collectionStore.clearCollect(trimmed, result);
      }
    } catch {
      // Entity tables are optional when metadata or data services are unavailable.
    }
  }
}

export async function hydrateSessionContext(
  input: HydrateSessionContextInput,
): Promise<void> {
  const snapshot = await fetchRuntimeStateSnapshot(input.appId, input.sessionId);
  if (snapshot) {
    hydrateFromSnapshot(snapshot, input.variableStore, input.collectionStore);
  }
  await hydrateEntityCollections(input);
}
