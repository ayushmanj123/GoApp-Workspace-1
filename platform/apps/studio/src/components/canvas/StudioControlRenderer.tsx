import type { Control } from "../../api/controls-api";
import { ensureStudioRegistry } from "../../registry/setup";
import { normalizeControlType } from "../../property-metadata/registry";
import {
  resolveRegistryType,
  supportsStudioRegistryRendering,
} from "../../utils/registry-type";
import { useApplicationStore } from "../../store/applicationStore";
import {
  expandDefinitionForInstance,
  readComponentDefinitionId,
} from "../../utils/component-definition";
import registry from "@goapps/ui/registry.component-registry";
import styles from "./StudioControlRenderer.module.css";

ensureStudioRegistry();

interface StudioControlRendererProps {
  control: Control;
}

export function StudioControlRenderer({ control }: StudioControlRendererProps) {
  const allControls = useApplicationStore((s) => s.controls);
  const componentDefinitions = useApplicationStore((s) => s.componentDefinitions);

  if (!supportsStudioRegistryRendering(control.control_type)) {
    return null;
  }

  const definition = registry.get(resolveRegistryType(control.control_type));
  if (!definition) {
    return null;
  }

  const props: Record<string, unknown> = { ...(control.properties ?? {}) };
  props.controlName = control.name;

  if (normalizeControlType(control.control_type) === "gallery") {
    props.templateControls = allControls
      .filter((item) => item.parent_control_id === control.id)
      .map((item) => ({
        ...item,
        children: [],
      }));
  }

  if (normalizeControlType(control.control_type) === "form") {
    props.templateControls = allControls
      .filter((item) => item.parent_control_id === control.id)
      .map((item) => ({
        ...item,
        children: [],
      }));
  }

  if (normalizeControlType(control.control_type) === "component") {
    const definitionId = readComponentDefinitionId(control.properties);
    const definition = componentDefinitions.find((item) => item.id === definitionId);
    if (definition) {
      props.templateControls = expandDefinitionForInstance(definition, control);
    }
  }

  return (
    <div className={styles.host}>{definition.renderRuntime(props)}</div>
  );
}
