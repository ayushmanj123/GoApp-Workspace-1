import registerRuntime from "../../../runtime/src/registry-bridge";

let initialized = false;

export function ensureStudioRegistry(): void {
  if (initialized) {
    return;
  }
  registerRuntime();
  initialized = true;
}
