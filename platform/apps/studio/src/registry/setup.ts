import registerRuntime from "../../../runtime/src/registry-bridge";
import { registerDesignerRenderers } from "../canvas/designer/register-designer-renderers";

let initialized = false;

export function ensureStudioRegistry(): void {
  if (initialized) {
    return;
  }
  registerRuntime();
  registerDesignerRenderers();
  initialized = true;
}
