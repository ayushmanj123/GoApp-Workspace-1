import type { Control } from "../api/controls-api";
import type {
  ComponentCustomProperty,
  ComponentDefinitionRecord,
  ComponentSnapshotControl,
} from "../api/component-definitions-api";
import { TENANT_ID } from "../api/metadata-client";
import { createLocalControlId } from "./control-ids";

export const COMPONENT_DRAFT_SCREEN_ID = "component-draft";

const COMPONENT_REFERENCE = /^Component\.([A-Za-z][A-Za-z0-9]*)$/;

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

  return snapshots.map((snapshot) => {
    const parentLocal = snapshot.parent_local_id;
    const parentId = parentLocal ? localToId.get(parentLocal) ?? instance.id : instance.id;
    return {
      id: localToId.get(snapshot.local_id) ?? `${instance.id}:${snapshot.local_id}`,
      tenant_id: instance.tenant_id,
      screen_id: instance.screen_id,
      parent_control_id: parentId,
      control_type: snapshot.control_type,
      name: snapshot.name,
      x: snapshot.x,
      y: snapshot.y,
      width: snapshot.width,
      height: snapshot.height,
      z_index: snapshot.z_index,
      properties: substituteComponentProperties(
        snapshot.properties,
        instance.properties,
        definition.definition_json?.properties,
      ) ?? null,
      deleted_at: null,
      CreatedOn: instance.CreatedOn,
      ModifiedOn: instance.ModifiedOn,
    };
  });
}

export function controlsFromSnapshots(snapshots: ComponentSnapshotControl[]): Control[] {
  const now = new Date().toISOString();
  const localToId = new Map<string, string>();
  for (const snapshot of snapshots) {
    localToId.set(snapshot.local_id, createLocalControlId());
  }
  return snapshots.map((snapshot) => ({
    id: localToId.get(snapshot.local_id) ?? createLocalControlId(),
    tenant_id: TENANT_ID,
    screen_id: COMPONENT_DRAFT_SCREEN_ID,
    parent_control_id: snapshot.parent_local_id
      ? localToId.get(snapshot.parent_local_id) ?? null
      : null,
    control_type: snapshot.control_type,
    name: snapshot.name,
    x: snapshot.x,
    y: snapshot.y,
    width: snapshot.width,
    height: snapshot.height,
    z_index: snapshot.z_index,
    properties: snapshot.properties ?? null,
    deleted_at: null,
    CreatedOn: now,
    ModifiedOn: now,
  }));
}

export function snapshotsFromControls(controls: Control[]): ComponentSnapshotControl[] {
  const idToLocal = new Map<string, string>();
  controls.forEach((control, index) => {
    idToLocal.set(control.id, index === 0 ? "root" : control.id);
  });
  return controls.map((control) => ({
    local_id: idToLocal.get(control.id) ?? control.id,
    parent_local_id: control.parent_control_id
      ? idToLocal.get(control.parent_control_id) ?? null
      : null,
    control_type: control.control_type,
    name: control.name,
    x: control.x,
    y: control.y,
    width: control.width,
    height: control.height,
    z_index: control.z_index,
    properties: control.properties ?? undefined,
  }));
}

export function substituteComponentProperties(
  properties: Record<string, unknown> | null | undefined,
  instanceProperties: Record<string, unknown> | null | undefined,
  contract?: ComponentCustomProperty[],
): Record<string, unknown> | undefined {
  if (!properties) return undefined;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    next[key] = substituteComponentValue(value, instanceProperties, contract);
  }
  return next;
}

function substituteComponentValue(
  value: unknown,
  instanceProperties: Record<string, unknown> | null | undefined,
  contract?: ComponentCustomProperty[],
): unknown {
  if (!value || typeof value !== "object" || !("formula" in value)) return value;
  const formula = String((value as { formula?: unknown }).formula ?? "").trim();
  const match = formula.match(COMPONENT_REFERENCE);
  if (!match || !instanceProperties) return value;
  const name = match[1];
  const replacement = lookupInstanceProperty(instanceProperties, name);
  if (!replacement || !shouldBindInstanceProperty(name, replacement, contract)) return value;
  return replacement;
}

function lookupInstanceProperty(
  instanceProperties: Record<string, unknown>,
  name: string,
): unknown {
  const direct = instanceProperties[name];
  if (direct && typeof direct === "object") return direct;
  const found = Object.entries(instanceProperties).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  if (found && found[1] && typeof found[1] === "object") return found[1];
  return undefined;
}

function shouldBindInstanceProperty(
  name: string,
  replacement: unknown,
  contract?: ComponentCustomProperty[],
): boolean {
  const direction = contract?.find((property) => property.name.toLowerCase() === name.toLowerCase())?.direction ?? "input";
  if (direction === "action") return true;
  if (direction === "output") return false;
  if (!replacement || typeof replacement !== "object") return true;
  if ("value" in replacement) return true;
  const formula = "formula" in replacement ? String((replacement as { formula?: unknown }).formula ?? "").trim() : "";
  return /^[A-Za-z][A-Za-z0-9]*$/.test(formula);
}

export function instanceInputProperties(
  contract: ComponentCustomProperty[],
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const property of contract) {
    if (property.direction === "output") continue;
    if (property.dataType === "table" || property.dataType === "record" || property.direction === "action") {
      properties[property.name] = { formula: "" };
      continue;
    }
    if (property.dataType === "boolean") {
      properties[property.name] = { value: false };
      continue;
    }
    if (property.dataType === "number") {
      properties[property.name] = { value: 0 };
      continue;
    }
    properties[property.name] = { value: "" };
  }
  return properties;
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
