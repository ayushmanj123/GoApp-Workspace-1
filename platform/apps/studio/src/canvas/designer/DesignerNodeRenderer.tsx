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
import { renderStudioDesignerPreview } from "./register-designer-renderers";
import styles from "../../components/canvas/StudioControlRenderer.module.css";

ensureStudioRegistry();

interface DesignerNodeRendererProps {
  control: Control;
  selected?: boolean;
}

function FallbackBox({ label }: { label: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        border: "1px solid #c8c8c8",
        borderRadius: 4,
        background: "#f0f0f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        color: "#555",
        userSelect: "none",
        pointerEvents: "none",
      }}
    >
      {label}
    </div>
  );
}

export function DesignerNodeRenderer({
  control,
  selected = false,
}: DesignerNodeRendererProps) {
  const allControls = useApplicationStore((s) => s.controls);
  const componentDefinitions = useApplicationStore((s) => s.componentDefinitions);

  const resolvedType = resolveRegistryType(control.control_type);

  if (!supportsStudioRegistryRendering(control.control_type)) {
    return <FallbackBox label={control.name || resolvedType} />;
  }

  const props: Record<string, unknown> = { ...(control.properties ?? {}) };
  props.controlName = control.name;
  props.selected = selected;

  const renderChild = (child: Control) => (
    <DesignerNodeRenderer control={child} selected={false} />
  );
  props.renderChild = renderChild;

  if (normalizeControlType(control.control_type) === "gallery") {
    props.templateControls = allControls
      .filter((item) => item.parent_control_id === control.id)
      .map((item) => ({ ...item, children: [] }));
  }

  if (normalizeControlType(control.control_type) === "form") {
    props.templateControls = allControls
      .filter((item) => item.parent_control_id === control.id)
      .map((item) => ({ ...item, children: [] }));
  }

  if (normalizeControlType(control.control_type) === "component") {
    const definitionId = readComponentDefinitionId(control.properties);
    const compDef = componentDefinitions.find((item) => item.id === definitionId);
    if (compDef) {
      props.templateControls = expandDefinitionForInstance(compDef, control);
    }
  }

  if (normalizeControlType(control.control_type) === "container") {
    props.templateControls = allControls
      .filter((item) => item.parent_control_id === control.id)
      .map((item) => ({ ...item, children: [] }));
  }

  const rendered = renderStudioDesignerPreview(resolvedType, props);

  if (rendered === null || rendered === undefined) {
    return <FallbackBox label={control.name || resolvedType} />;
  }

  return <div className={styles.host}>{rendered}</div>;
}
