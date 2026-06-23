export const LOCAL_CONTROL_ID_PREFIX = "local-";

export function isLocalControlId(controlId: string): boolean {
  return controlId.startsWith(LOCAL_CONTROL_ID_PREFIX);
}

export function createLocalControlId(): string {
  return `${LOCAL_CONTROL_ID_PREFIX}${crypto.randomUUID()}`;
}
