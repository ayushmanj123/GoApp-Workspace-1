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
import { readPropertyFormula, readPropertyValue } from "../../utils/control-properties";
import { isGoogleSheetsConnector } from "../../utils/google-sheets-columns";
import { renderStudioDesignerPreview } from "./register-designer-renderers";
import styles from "../../components/canvas/StudioControlRenderer.module.css";
import { useEffect } from "react";
import { designerFormulaEntry } from "./designer-formula-cache";

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

function resolveItemsDatasourceName(control: Control): string {
  const formula = readPropertyFormula(control.properties?.items).trim();
  if (formula) return formula;
  return String(readPropertyValue("text", control.properties?.items) ?? "").trim();
}

export function DesignerNodeRenderer({
  control,
  selected = false,
}: DesignerNodeRendererProps) {
  const allControls = useApplicationStore((s) => s.controls);
  const componentDefinitions = useApplicationStore((s) => s.componentDefinitions);
  const connectors = useApplicationStore((s) => s.connectors);
  const sheetColumnsByConnectorId = useApplicationStore((s) => s.sheetColumnsByConnectorId);
  const sheetPreviewRowsByConnectorId = useApplicationStore(
    (s) => s.sheetPreviewRowsByConnectorId,
  );
  const loadSheetColumns = useApplicationStore((s) => s.loadSheetColumns);

  const resolvedType = resolveRegistryType(control.control_type);
  const controlKind = normalizeControlType(control.control_type);
  const itemsName =
    controlKind === "gallery" || controlKind === "datatable"
      ? resolveItemsDatasourceName(control)
      : "";
  const boundSheetsConnector = itemsName
    ? connectors.find(
        (connector) =>
          connector.name === itemsName && isGoogleSheetsConnector(connector),
      )
    : undefined;

  useEffect(() => {
    if (!boundSheetsConnector) return;
    void loadSheetColumns(boundSheetsConnector.id);
  }, [boundSheetsConnector, loadSheetColumns]);

  if (!supportsStudioRegistryRendering(control.control_type)) {
    return <FallbackBox label={control.name || resolvedType} />;
  }

  const cached = designerFormulaEntry(control.id);
  const props: Record<string, unknown> = {
    ...(cached?.properties ?? control.properties ?? {}),
  };
  props.controlName = control.name;
  props.selected = selected;

  const renderChild = (child: Control) => (
    <DesignerNodeRenderer control={child} selected={false} />
  );
  props.renderChild = renderChild;

  if (boundSheetsConnector) {
    props.columnHints = sheetColumnsByConnectorId[boundSheetsConnector.id] ?? [];
    props.previewRows =
      sheetPreviewRowsByConnectorId[boundSheetsConnector.id] ?? [];
  }

  if (controlKind === "gallery") {
    props.templateControls = allControls
      .filter((item) => item.parent_control_id === control.id)
      .slice()
      .sort((a, b) => a.z_index - b.z_index)
      .map((item) => ({ ...item, children: [] }));
  }

  if (controlKind === "form") {
    props.templateControls = allControls
      .filter((item) => item.parent_control_id === control.id)
      .slice()
      .sort((a, b) => a.z_index - b.z_index)
      .map((item) => ({ ...item, children: [] }));
  }

  if (controlKind === "datacard") {
    props.templateControls = allControls
      .filter((item) => item.parent_control_id === control.id)
      .slice()
      .sort((a, b) => a.z_index - b.z_index)
      .map((item) => ({ ...item, children: [] }));
  }

  if (controlKind === "component") {
    const definitionId = readComponentDefinitionId(control.properties);
    const compDef = componentDefinitions.find((item) => item.id === definitionId);
    if (compDef) {
      props.templateControls = expandDefinitionForInstance(compDef, control);
    }
  }

  if (controlKind === "container") {
    props.templateControls = allControls
      .filter((item) => item.parent_control_id === control.id)
      .slice()
      .sort((a, b) => a.z_index - b.z_index)
      .map((item) => ({ ...item, children: [] }));
  }

  const rendered = renderStudioDesignerPreview(resolvedType, props);

  if (rendered === null || rendered === undefined) {
    return <FallbackBox label={control.name || resolvedType} />;
  }

  return <div className={styles.host}>{rendered}</div>;
}
