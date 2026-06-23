import type { Control } from "../../api/controls-api";
import { ensureStudioRegistry } from "../../registry/setup";
import {
  resolveRegistryType,
  supportsStudioRegistryRendering,
} from "../../utils/registry-type";
import registry from "../../../../../packages/ui/src/registry.component-registry";
import styles from "./StudioControlRenderer.module.css";

ensureStudioRegistry();

interface StudioControlRendererProps {
  control: Control;
}

export function StudioControlRenderer({ control }: StudioControlRendererProps) {
  if (!supportsStudioRegistryRendering(control.control_type)) {
    return null;
  }

  const definition = registry.get(resolveRegistryType(control.control_type));
  if (!definition) {
    return null;
  }

  const props = { ...(control.properties ?? {}) };

  return (
    <div className={styles.host}>{definition.renderRuntime(props)}</div>
  );
}
