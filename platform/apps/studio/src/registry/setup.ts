import registerRuntime from "../../../runtime/src/registry-bridge";
import { registerDesignerRenderers } from "../canvas/designer/register-designer-renderers";

let runtimeInitialized = false;

export function ensureStudioRegistry(): void {
  if (!runtimeInitialized) {
    registerRuntime();
    runtimeInitialized = true;
  }
  // Always re-apply designer patches (survives HMR / runtime re-register wiping noopDesigner).
  registerDesignerRenderers();
}
