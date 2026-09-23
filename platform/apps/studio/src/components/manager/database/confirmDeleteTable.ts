import { entitiesApi } from "../../../api/entities-api";

/** Confirm table delete after loading lookup dependents. Returns true if user confirms. */
export async function confirmDeleteTable(entityId: string, displayName: string): Promise<boolean> {
  let depsNote = "";
  try {
    const deps = await entitiesApi.listDependents(entityId);
    if (deps.items?.length) {
      depsNote = `\n\nLookup dependents (${deps.items.length}): ${deps.items
        .map((d) => d.display_name || d.name)
        .join(", ")}`;
    } else {
      depsNote = "\n\nNo incoming lookup dependents.";
    }
  } catch (err) {
    depsNote = `\n\n(Could not load dependents: ${err instanceof Error ? err.message : "error"})`;
  }
  return window.confirm(`Delete table "${displayName}"? This cannot be undone.${depsNote}`);
}
