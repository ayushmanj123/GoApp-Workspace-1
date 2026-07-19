import type { Control } from "../api/controls-api";

/** Lock is stored on control properties (no schema migration). */
export function isControlLocked(control: Control | null | undefined): boolean {
  if (!control?.properties) {
    return false;
  }
  return control.properties.locked === true;
}

export function withLockedProperty(
  properties: Record<string, unknown> | null | undefined,
  locked: boolean,
): Record<string, unknown> {
  const next = { ...(properties ?? {}) };
  if (locked) {
    next.locked = true;
  } else {
    delete next.locked;
  }
  return next;
}
