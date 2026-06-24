import type { Control } from "../api/controls-api";
import type {
  ComponentDefinitionRecord,
  ComponentSnapshotControl,
} from "../api/component-definitions-api";

function collectSubtree(controls: Control[], rootId: string): Control[] {
  const byParent = new Map<string, Control[]>();
  for (const control of controls) {
    if (!control.parent_control_id) {
      continue;
    }
    const siblings = byParent.get(control.parent_control_id) ?? [];
    siblings.push(control);
    byParent.set(control.parent_control_id, siblings);
  }

  const result: Control[] = [];
  const visit = (id: string) => {
    const control = controls.find((item) => item.id === id);
    if (!control) {
      return;
    }
    result.push(control);
    for (const child of byParent.get(id) ?? []) {
      visit(child.id);
    }
  };
  visit(rootId);
  return result;
}

export function snapshotControlSubtree(
  controls: Control[],
  rootControlId: string,
): ComponentSnapshotControl[] {
  const subtree = collectSubtree(controls, rootControlId);
  const root = subtree[0];
  if (!root) {
    return [];
  }

  const idToLocal = new Map<string, string>();
  subtree.forEach((control, index) => {
    idToLocal.set(control.id, index === 0 ? "root" : control.id);
  });

  return subtree.map((control) => {
    const isRoot = control.id === rootControlId;
    const parentLocalId =
      !isRoot && control.parent_control_id
        ? idToLocal.get(control.parent_control_id) ?? null
        : null;

    return {
      local_id: idToLocal.get(control.id) ?? control.id,
      parent_local_id: parentLocalId,
      control_type: control.control_type,
      name: control.name,
      x: control.x - root.x,
      y: control.y - root.y,
      width: control.width,
      height: control.height,
      z_index: control.z_index,
      properties: control.properties ?? undefined,
    };
  });
}

export function readComponentDefinitionId(
  properties: Record<string, unknown> | null | undefined,
): string {
  if (!properties) {
    return "";
  }
  const raw = properties.definition_id;
  if (typeof raw === "string") {
    return raw.trim();
  }
  if (raw && typeof raw === "object" && "value" in raw) {
    const value = (raw as { value?: unknown }).value;
    return typeof value === "string" ? value.trim() : "";
  }
  return "";
}

export function expandDefinitionForInstance(
  definition: ComponentDefinitionRecord,
  instance: Control,
): Control[] {
  const snapshots = definition.definition_json?.controls ?? [];
  if (snapshots.length === 0) {
    return [];
  }

  const localToId = new Map<string, string>();
  for (const snapshot of snapshots) {
    localToId.set(snapshot.local_id, `${instance.id}:${snapshot.local_id}`);
  }

  return snapshots.map((snapshot) => ({
    id: localToId.get(snapshot.local_id) ?? `${instance.id}:${snapshot.local_id}`,
    tenant_id: instance.tenant_id,
    screen_id: instance.screen_id,
    parent_control_id: null,
    control_type: snapshot.control_type,
    name: snapshot.name,
    x: snapshot.x,
    y: snapshot.y,
    width: snapshot.width,
    height: snapshot.height,
    z_index: snapshot.z_index,
    properties: snapshot.properties ?? null,
    deleted_at: null,
    CreatedOn: instance.CreatedOn,
    ModifiedOn: instance.ModifiedOn,
  }));
}

export function computeComponentBounds(
  snapshots: ComponentSnapshotControl[],
): { width: number; height: number } {
  if (snapshots.length === 0) {
    return { width: 240, height: 80 };
  }
  let maxRight = 0;
  let maxBottom = 0;
  for (const snapshot of snapshots) {
    maxRight = Math.max(maxRight, snapshot.x + snapshot.width);
    maxBottom = Math.max(maxBottom, snapshot.y + snapshot.height);
  }
  return {
    width: Math.max(120, Math.ceil(maxRight)),
    height: Math.max(40, Math.ceil(maxBottom)),
  };
}
