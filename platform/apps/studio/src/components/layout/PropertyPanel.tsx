import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { Control } from "../../api/controls-api";
import { FormulaEditorModal } from "../formula/FormulaEditorModal";
import {
  getPropertyDefinitions,
  isActionFormulaProperty,
  isDataFormulaProperty,
  isFormulaOnly,
  normalizeControlType,
  supportsFormulaMode,
  type PropertyFieldDefinition,
  type PropertyMode,
} from "../../property-metadata/registry";
import {
  getPropertyMode,
  readPropertyFormula,
  readPropertyValue,
  truncateFormula,
  writePropertyFormula,
  writePropertyValue,
} from "../../utils/control-properties";
import { useStudioStore } from "../../store/studioStore";
import { useApplicationStore } from "../../store/applicationStore";
import { buildStudioFormulaContext } from "../../utils/build-studio-formula-context";
import { readComponentDefinitionId } from "../../utils/component-definition";
import { componentScopeDefaults } from "../../../../runtime/src/formula/component-scope";
import { resolveFormEntity, resolveFormGoogleSheetsConnector } from "../../utils/generate-form-fields";
import { isGoogleSheetsConnector } from "../../utils/google-sheets-columns";
import { PropertyCard, TabBar } from "../ui";
import { ComponentCustomProperties } from "./ComponentCustomProperties";
import { ComponentInstanceFields } from "./ComponentInstanceFields";
import styles from "./PropertyPanel.module.css";

const ChevronLeftIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

interface PropRowProps {
  label: string;
  type?: "text" | "number" | "color";
  value: string;
  onChange: (value: string) => void;
}

function isCommitableNumber(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "." || trimmed === "-.") return false;
  return Number.isFinite(Number(trimmed));
}

function PropRow({ label, type = "text", value, onChange }: PropRowProps) {
  const [draft, setDraft] = useState(value);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(value);
    }
  }, [value]);

  return (
    <div className={styles.propRow}>
      <label className={styles.propLabel}>{label}</label>
      <input
        className={styles.propInput}
        type={type}
        aria-label={label}
        value={draft}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          if (type === "number" && !isCommitableNumber(draft)) {
            setDraft(value);
            return;
          }
          if (draft !== value) {
            onChange(draft);
          }
        }}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const next = event.currentTarget.value;
          setDraft(next);
          if (type === "number" && !isCommitableNumber(next)) {
            return;
          }
          onChange(next);
        }}
      />
    </div>
  );
}

interface MetadataPropRowProps {
  definition: PropertyFieldDefinition;
  value: unknown;
  evaluationContext: Record<string, unknown>;
  onChange: (entry: Record<string, unknown>) => void;
  groupId?: string;
}

function PropertyModeSelector({
  definition,
  mode,
  onModeChange,
  groupId,
}: {
  definition: PropertyFieldDefinition;
  mode: PropertyMode;
  onModeChange: (mode: PropertyMode) => void;
  groupId?: string;
}) {
  const radioName = `${groupId ?? "property"}-${definition.name}-mode`;
  return (
    <div className={styles.propModeRow}>
      <div className={styles.modeOptions}>
        <label className={styles.modeOption}>
          <input
            type="radio"
            name={radioName}
            checked={mode === "static"}
            data-testid={`${definition.name}-mode-static`}
            onChange={() => onModeChange("static")}
          />
          Static
        </label>
        <label className={styles.modeOption}>
          <input
            type="radio"
            name={radioName}
            checked={mode === "formula"}
            data-testid={`${definition.name}-mode-formula`}
            onChange={() => onModeChange("formula")}
          />
          Formula
        </label>
      </div>
    </div>
  );
}

function MetadataPropRow({
  definition,
  value,
  evaluationContext,
  onChange,
  groupId,
}: MetadataPropRowProps) {
  const { label, type } = definition;
  const formulaCapable = supportsFormulaMode(definition);
  const mode = getPropertyMode(value);
  const [editorOpen, setEditorOpen] = useState(false);
  const setFormulaBarContext = useStudioStore((s) => s.setFormulaBarContext);
  const isDataFormula = isDataFormulaProperty(definition);
  const formulaValidationMode = isDataFormula ? "expression" : "action";

  const handleModeChange = (nextMode: PropertyMode) => {
    if (nextMode === "formula") {
      onChange(writePropertyFormula(readPropertyFormula(value)));
      return;
    }
    onChange(writePropertyValue(type, readPropertyValue(type, value)));
  };

  if (isFormulaOnly(definition)) {
    const formula = readPropertyFormula(value);
    const summary = truncateFormula(formula);

    const openEditor = () => {
      setFormulaBarContext({
        propertyLabel: label,
        propertyKey: definition.name,
        formula,
        validationMode: formulaValidationMode,
        onSave: (nextFormula) => {
          onChange(writePropertyFormula(nextFormula));
        },
      });
      setEditorOpen(true);
    };

    return (
      <div className={styles.propBlock}>
        <div className={styles.propRow}>
          <span className={styles.propLabel}>{label}</span>
          <span className={styles.formulaModeBadge}>
            {isDataFormula ? "Data" : "Action"}
          </span>
        </div>
        <div className={styles.formulaSummaryRow}>
          <span
            className={styles.formulaSummary}
            title={formula || undefined}
            data-testid={`${definition.name}-formula-summary`}
          >
            {summary || "(empty)"}
          </span>
        </div>
        <div className={styles.formulaEditorRow}>
          <button
            type="button"
            className={styles.formulaEditorBtn}
            data-testid={`${definition.name}-open-formula-editor`}
            onClick={openEditor}
          >
            Edit formula
          </button>
        </div>
        <FormulaEditorModal
          open={editorOpen}
          propertyLabel={label}
          initialFormula={formula}
          validationMode={formulaValidationMode}
          evaluationContext={evaluationContext}
          onSave={(nextFormula) => {
            onChange(writePropertyFormula(nextFormula));
            setFormulaBarContext({
              propertyLabel: label,
              propertyKey: definition.name,
              formula: nextFormula,
              validationMode: formulaValidationMode,
              onSave: (formulaText) => {
                onChange(writePropertyFormula(formulaText));
              },
            });
            setEditorOpen(false);
          }}
          onCancel={() => setEditorOpen(false)}
        />
      </div>
    );
  }

  if (mode === "formula" && formulaCapable) {
    const formula = readPropertyFormula(value);
    const summary = truncateFormula(formula);

    return (
      <div className={styles.propBlock}>
        <div className={styles.propRow}>
          <span className={styles.propLabel}>{label}</span>
          <span className={styles.formulaModeBadge}>Formula</span>
        </div>
        <div className={styles.formulaSummaryRow}>
          <span
            className={styles.formulaSummary}
            title={formula || undefined}
            data-testid={`${definition.name}-formula-summary`}
          >
            {summary || "(empty)"}
          </span>
        </div>
        <PropertyModeSelector
          definition={definition}
          mode={mode}
          groupId={groupId}
          onModeChange={handleModeChange}
        />
        <div className={styles.formulaEditorRow}>
          <button
            type="button"
            className={styles.formulaEditorBtn}
            data-testid={`${definition.name}-open-formula-editor`}
            onClick={() => setEditorOpen(true)}
          >
            Edit formula
          </button>
        </div>
        <FormulaEditorModal
          open={editorOpen}
          propertyLabel={label}
          initialFormula={formula}
          validationMode="expression"
          evaluationContext={evaluationContext}
          onSave={(nextFormula) => {
            onChange(writePropertyFormula(nextFormula));
            setEditorOpen(false);
          }}
          onCancel={() => setEditorOpen(false)}
        />
      </div>
    );
  }

  if (type === "boolean") {
    const checked = Boolean(readPropertyValue("boolean", value));
    return (
      <div className={styles.propBlock}>
        <div className={styles.propRow}>
          <label className={styles.propLabel}>{label}</label>
          <input
            className={styles.propInput}
            type="checkbox"
            aria-label={label}
            checked={checked}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange(writePropertyValue("boolean", event.currentTarget.checked))
            }
          />
        </div>
        <PropertyModeSelector
          definition={definition}
          mode={mode}
          groupId={groupId}
          onModeChange={handleModeChange}
        />
      </div>
    );
  }

  if (type === "number") {
    const numeric = readPropertyValue("number", value);
    return (
      <div className={styles.propBlock}>
        <PropRow
          label={label}
          type="number"
          value={String(numeric)}
          onChange={(nextValue) => {
            if (!isCommitableNumber(nextValue)) return;
            onChange(writePropertyValue("number", Number(nextValue)));
          }}
        />
        <PropertyModeSelector
          definition={definition}
          mode={mode}
          groupId={groupId}
          onModeChange={handleModeChange}
        />
      </div>
    );
  }

  const text = String(readPropertyValue(type, value));

  return (
    <div className={styles.propBlock}>
      <PropRow
        label={label}
        type={type === "color" ? "color" : "text"}
        value={text}
        onChange={(nextValue) => {
          onChange(writePropertyValue(type, nextValue));
        }}
      />
      {formulaCapable && (
        <PropertyModeSelector
          definition={definition}
          mode={mode}
          groupId={groupId}
          onModeChange={handleModeChange}
        />
      )}
    </div>
  );
}

function LayoutMetricRow({
  field,
  label,
  control,
  evaluationContext,
}: {
  field: "x" | "y" | "width" | "height";
  label: string;
  control: Control;
  evaluationContext: Record<string, unknown>;
}) {
  const updateControl = useApplicationStore((s) => s.updateControl);
  const stored = control.properties?.[field];
  const mode = getPropertyMode(stored);
  const [editorOpen, setEditorOpen] = useState(false);
  const definition = { name: field, label, type: "number" as const };
  const formula = readPropertyFormula(stored);

  const writeStatic = (nextValue: string) => {
    if (!isCommitableNumber(nextValue)) return;
    const parsed = Number(nextValue.trim());
    if (parsed === control[field] && mode !== "formula") return;
    const properties: Record<string, unknown> = { ...(control.properties ?? {}) };
    properties[field] = null;
    updateControl(control.id, { [field]: parsed, properties });
  };

  const writeFormula = (nextFormula: string) => {
    updateControl(control.id, {
      properties: {
        ...(control.properties ?? {}),
        [field]: writePropertyFormula(nextFormula),
      },
    });
  };

  if (mode === "formula") {
    return (
      <div className={styles.propBlock}>
        <div className={styles.propRow}>
          <span className={styles.propLabel}>{label}</span>
          <span className={styles.formulaModeBadge}>Formula</span>
        </div>
        <div className={styles.formulaSummaryRow}>
          <span className={styles.formulaSummary} title={formula || undefined}>
            {truncateFormula(formula) || "(empty)"}
          </span>
        </div>
        <PropertyModeSelector
          definition={definition}
          mode={mode}
          groupId={control.id}
          onModeChange={(next) => {
            if (next === "static") writeStatic(String(control[field] ?? 0));
          }}
        />
        <div className={styles.formulaEditorRow}>
          <button
            type="button"
            className={styles.formulaEditorBtn}
            onClick={() => setEditorOpen(true)}
          >
            Edit formula
          </button>
        </div>
        <FormulaEditorModal
          open={editorOpen}
          propertyLabel={label}
          initialFormula={formula}
          validationMode="expression"
          evaluationContext={evaluationContext}
          onSave={(nextFormula) => {
            writeFormula(nextFormula);
            setEditorOpen(false);
          }}
          onCancel={() => setEditorOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className={styles.propBlock}>
      <PropRow
        label={label}
        type="number"
        value={String(control[field] ?? 0)}
        onChange={writeStatic}
      />
      <PropertyModeSelector
        definition={definition}
        mode="static"
        groupId={control.id}
        onModeChange={(next) => {
          if (next === "formula") writeFormula(String(control[field] ?? 0));
        }}
      />
    </div>
  );
}

function splitColumnsCsv(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function DataTableColumnsPicker({
  selectedControl,
  itemsFormula,
  entities,
  entityFieldsByEntityId,
  connectors,
  sheetColumnsByConnectorId,
  loadSheetColumns,
  onWriteColumns,
}: {
  selectedControl: Control;
  itemsFormula: string;
  entities: Array<{ id: string; name: string }>;
  entityFieldsByEntityId: Record<string, Array<{ name: string }>>;
  connectors: Array<{ id: string; name: string; connector_type?: string }>;
  sheetColumnsByConnectorId: Record<string, string[]>;
  loadSheetColumns: (connectorId: string, force?: boolean) => Promise<string[]>;
  onWriteColumns: (csv: string) => void;
}) {
  const columnsValue = String(
    readPropertyValue("text", selectedControl.properties?.columns) ?? "",
  ).trim();
  const selectedNames = splitColumnsCsv(columnsValue);

  const sheetsConnector = connectors.find(
    (c) => c.name === itemsFormula && isGoogleSheetsConnector(c),
  );
  const entity = entities.find((e) => e.name === itemsFormula);

  useEffect(() => {
    if (!sheetsConnector) return;
    void loadSheetColumns(sheetsConnector.id);
  }, [sheetsConnector, loadSheetColumns]);

  const availableFromSource = sheetsConnector
    ? (sheetColumnsByConnectorId[sheetsConnector.id] ?? [])
    : entity
      ? (entityFieldsByEntityId[entity.id] ?? []).map((f) => f.name)
      : [];
  const availableNames =
    availableFromSource.length > 0
      ? availableFromSource
      : selectedNames.length > 0
        ? selectedNames
        : [];

  const toggleColumn = (name: string, checked: boolean) => {
    const next = checked
      ? [...selectedNames.filter((n) => n !== name), name]
      : selectedNames.filter((n) => n !== name);
    onWriteColumns(next.join(", "));
  };

  const moveColumn = (name: string, direction: -1 | 1) => {
    const index = selectedNames.indexOf(name);
    if (index < 0) return;
    const swap = index + direction;
    if (swap < 0 || swap >= selectedNames.length) return;
    const next = [...selectedNames];
    [next[index], next[swap]] = [next[swap], next[index]];
    onWriteColumns(next.join(", "));
  };

  return (
    <div className={styles.propBlock} data-testid="datatable-columns-picker">
      <label className={styles.propLabel} htmlFor="datatable-columns-text">
        Columns
      </label>
      {availableNames.length > 0 ? (
        <ul
          className={styles.columnPickerList}
          data-testid="datatable-columns-checklist"
        >
          {availableNames.map((name) => {
            const checked = selectedNames.includes(name);
            return (
              <li key={name} className={styles.columnPickerRow}>
                <label className={styles.columnPickerLabel}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      toggleColumn(name, event.currentTarget.checked)
                    }
                  />
                  <span>{name}</span>
                </label>
                {checked ? (
                  <span className={styles.columnPickerReorder}>
                    <button
                      type="button"
                      aria-label={`Move ${name} up`}
                      onClick={() => moveColumn(name, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${name} down`}
                      onClick={() => moveColumn(name, 1)}
                    >
                      ↓
                    </button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.stubHint}>
          Bind Items to an entity or Google Sheets connector (or type column names
          below) to pick visible columns.
        </p>
      )}
      <input
        id="datatable-columns-text"
        className={styles.datasourceSelect}
        data-testid="datatable-columns-text"
        value={columnsValue}
        placeholder="Name, Status, Amount"
        onChange={(event) => onWriteColumns(event.currentTarget.value)}
      />
      <p className={styles.stubHint}>
        Comma-separated field names written to the <code>columns</code> property.
        Leave empty to infer from loaded rows.
      </p>
    </div>
  );
}

export function PropertyPanel() {
  const { applicationId: routeAppId } = useParams<{ applicationId?: string }>();
  const collapsed = useStudioStore((s) => s.propertiesCollapsed);
  const toggleProperties = useStudioStore((s) => s.toggleProperties);
  const propertyTab = useStudioStore((s) => s.propertyTab);
  const setPropertyTab = useStudioStore((s) => s.setPropertyTab);
  const selectedControlId = useStudioStore((s) => s.selectedControlId);
  const appName = useStudioStore((s) => s.appName);
  const screenName = useStudioStore((s) => s.screenName);
  const controls = useApplicationStore((s) => s.controls);
  const selectedScreenId = useApplicationStore((s) => s.selectedScreenId);
  const screens = useApplicationStore((s) => s.screens);
  const entities = useApplicationStore((s) => s.entities);
  const entityFieldsByEntityId = useApplicationStore((s) => s.entityFieldsByEntityId);
  const connectors = useApplicationStore((s) => s.connectors);
  const sheetColumnsByConnectorId = useApplicationStore((s) => s.sheetColumnsByConnectorId);
  const selectedApplicationId = useApplicationStore((s) => s.selectedApplicationId);
  const loadConnectors = useApplicationStore((s) => s.loadConnectors);
  const loadEntities = useApplicationStore((s) => s.loadEntities);
  const loadSheetColumns = useApplicationStore((s) => s.loadSheetColumns);
  const refreshSheetPreview = useApplicationStore((s) => s.refreshSheetPreview);
  const sheetColumnsLoadingByConnectorId = useApplicationStore(
    (s) => s.sheetColumnsLoadingByConnectorId,
  );
  const updateControl = useApplicationStore((s) => s.updateControl);
  const generateFormFields = useApplicationStore((s) => s.generateFormFields);
  const updateScreenOnVisible = useApplicationStore((s) => s.updateScreenOnVisible);
  const deleteControl = useApplicationStore((s) => s.deleteControl);
  const [onVisibleEditorOpen, setOnVisibleEditorOpen] = useState(false);
  const [generatingFields, setGeneratingFields] = useState(false);
  const [refreshingPreview, setRefreshingPreview] = useState(false);

  const applicationId = routeAppId ?? selectedApplicationId;

  useEffect(() => {
    if (!applicationId) return;
    void loadEntities(applicationId);
    void loadConnectors(applicationId);
  }, [applicationId, loadEntities, loadConnectors]);

  const editingDefinitionId = useApplicationStore((s) => s.editingDefinitionId);
  const componentProperties = useApplicationStore((s) => s.componentProperties);
  const setComponentProperties = useApplicationStore((s) => s.setComponentProperties);
  const componentDefinitions = useApplicationStore((s) => s.componentDefinitions);
  const selectedControl = controls.find(
    (control) => control.id === selectedControlId,
  );
  const componentContract = selectedControl?.control_type === "component"
    ? componentDefinitions.find((item) => item.id === readComponentDefinitionId(selectedControl.properties))
        ?.definition_json?.properties ?? []
    : [];
  const selectedScreen = screens.find((screen) => screen.id === selectedScreenId);
  const onVisibleFormula = selectedScreen?.on_visible ?? "";
  const propertyDefinitions = selectedControl
    ? getPropertyDefinitions(selectedControl.control_type)
    : [];
  const evaluationContext = {
    ...buildStudioFormulaContext(appName, controls),
    ...(editingDefinitionId ? { Component: componentScopeDefaults(componentProperties) } : {}),
  };
  const resolvedFormEntity = selectedControl
    ? resolveFormEntity(selectedControl, entities)
    : null;
  const resolvedSheetsConnector = selectedControl
    ? resolveFormGoogleSheetsConnector(selectedControl, connectors)
    : null;
  const resolvedFormFieldCount = resolvedFormEntity
    ? (entityFieldsByEntityId[resolvedFormEntity.id] ?? []).length
    : resolvedSheetsConnector
      ? (sheetColumnsByConnectorId[resolvedSheetsConnector.id] ?? []).length
      : 0;
  const canGenerateFormFields = Boolean(
    (resolvedFormEntity && resolvedFormFieldCount > 0) ||
      resolvedSheetsConnector,
  );

  useEffect(() => {
    if (!resolvedSheetsConnector) return;
    void loadSheetColumns(resolvedSheetsConnector.id);
  }, [resolvedSheetsConnector, loadSheetColumns]);

  const updateName = (nextValue: string) => {
    if (!selectedControl) return;
    updateControl(selectedControl.id, { name: nextValue });
  };

  const updateMetadataProperty = (
    definition: PropertyFieldDefinition,
    entry: Record<string, unknown>,
  ) => {
    if (!selectedControl) return;
    updateControl(selectedControl.id, {
      properties: {
        ...(selectedControl.properties ?? {}),
        [definition.name]: entry,
      },
    });
  };

  return (
    <aside className={`${styles.panel} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.header}>
        <button
          className={styles.collapseBtn}
          onClick={toggleProperties}
          title={collapsed ? "Expand Properties" : "Collapse Properties"}
        >
          {collapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </button>
        {!collapsed && <span className={styles.title}>Properties</span>}
      </div>

      {!collapsed && (
        <>
          <TabBar
            tabs={[
              { id: "style", label: "Style" },
              { id: "data", label: "Data" },
              { id: "actions", label: "Actions" },
            ]}
            activeTab={propertyTab}
            onTabChange={(tab) =>
              setPropertyTab(tab as "style" | "data" | "actions")
            }
          />
        <div className={styles.content}>
          {editingDefinitionId && (
            <ComponentCustomProperties
              properties={componentProperties}
              onChange={setComponentProperties}
            />
          )}
          {selectedControl?.control_type === "component" && (
            <ComponentInstanceFields
              control={selectedControl}
              contract={componentContract}
              onChange={(name, entry) => {
                updateControl(selectedControl.id, {
                  properties: {
                    ...(selectedControl.properties ?? {}),
                    [name]: entry,
                  },
                });
              }}
            />
          )}
          {selectedControl ? (
            <>
              <div className={styles.controlBadge}>
                <span className={styles.controlName}>
                  Selected: {selectedControl.name}
                </span>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => void deleteControl(selectedControl.id)}
                >
                  Delete
                </button>
              </div>

              {propertyTab === "style" && (
                <>
                  <PropertyCard title="Layout">
                    <PropRow
                      label="Name"
                      value={selectedControl.name}
                      onChange={updateName}
                    />
                    <LayoutMetricRow
                      field="x"
                      label="X"
                      control={selectedControl}
                      evaluationContext={evaluationContext}
                    />
                    <LayoutMetricRow
                      field="y"
                      label="Y"
                      control={selectedControl}
                      evaluationContext={evaluationContext}
                    />
                    <LayoutMetricRow
                      field="width"
                      label="Width"
                      control={selectedControl}
                      evaluationContext={evaluationContext}
                    />
                    <LayoutMetricRow
                      field="height"
                      label="Height"
                      control={selectedControl}
                      evaluationContext={evaluationContext}
                    />
                  </PropertyCard>
                  <PropertyCard title="Appearance">
                    {propertyDefinitions
                      .filter(
                        (d) =>
                          d.type === "color" ||
                          d.type === "text" ||
                          d.type === "boolean" ||
                          d.type === "number",
                      )
                      .map((definition) => (
                        <MetadataPropRow
                          key={definition.name}
                          definition={definition}
                          groupId={selectedControl.id}
                          value={selectedControl.properties?.[definition.name]}
                          evaluationContext={evaluationContext}
                          onChange={(entry) =>
                            updateMetadataProperty(definition, entry)
                          }
                        />
                      ))}
                  </PropertyCard>
                </>
              )}

              {propertyTab === "data" && (
                <PropertyCard title="Data Binding">
                  {(() => {
                    const dataProps = propertyDefinitions.filter((d) =>
                      [
                        "items",
                        "item",
                        "default",
                        "value",
                        "mode",
                        "filter",
                        "sort",
                        "limit",
                        "pageSize",
                        "offset",
                        "columns",
                        "showRefresh",
                        "dataSource",
                      ].includes(d.name),
                    );
                    if (dataProps.length === 0) {
                      return (
                        <p className={styles.stubHint}>
                          This control has no data-binding properties. Use an entity
                          name or formula on Gallery Items / Form Item (for example{" "}
                          <code>Customers</code> or <code>Gallery.Selected</code>).
                        </p>
                      );
                    }
                    const hasItems = dataProps.some((d) => d.name === "items");
                    const hasItem = dataProps.some((d) => d.name === "item");
                    const hasDataSource = dataProps.some((d) => d.name === "dataSource");
                    const itemsFormula = readPropertyFormula(
                      selectedControl.properties?.items,
                    );
                    const itemFormula = readPropertyFormula(
                      selectedControl.properties?.item,
                    );
                    const dataSourceValue = String(
                      readPropertyValue("text", selectedControl.properties?.dataSource) ||
                        readPropertyFormula(selectedControl.properties?.dataSource),
                    ).trim();
                    const selectionSourceNames = controls
                      .filter((c) => {
                        if (c.screen_id !== selectedScreenId) return false;
                        const type = c.control_type.toLowerCase();
                        return type === "gallery" || type === "datatable";
                      })
                      .map((c) => c.name);
                    const selectionFormulas = selectionSourceNames.map(
                      (n) => `${n}.Selected`,
                    );
                    const datasourceNames = [
                      ...entities.map((e) => e.name),
                      ...connectors.map((c) => c.name),
                    ];
                    const connectorOptionLabel = (connector: (typeof connectors)[number]) =>
                      isGoogleSheetsConnector(connector)
                        ? `${connector.name} (google_sheets)`
                        : connector.name;
                    return (
                      <>
                        {hasItems ? (
                          <div className={styles.propBlock}>
                            <label className={styles.propLabel} htmlFor="items-datasource-picker">
                              Items datasource
                            </label>
                            <select
                              id="items-datasource-picker"
                              className={styles.datasourceSelect}
                              data-testid="items-datasource-picker"
                              value={
                                datasourceNames.includes(itemsFormula)
                                  ? itemsFormula
                                  : ""
                              }
                              onChange={(event) => {
                                const name = event.currentTarget.value;
                                if (!name || !selectedControl) return;
                                updateMetadataProperty(
                                  { name: "items", label: "Items", type: "formula" },
                                  writePropertyFormula(name),
                                );
                              }}
                            >
                              <option value="">
                                {itemsFormula && !datasourceNames.includes(itemsFormula)
                                  ? `Custom: ${itemsFormula}`
                                  : "Choose entity or connector…"}
                              </option>
                              {entities.length > 0 ? (
                                <optgroup label="Entities">
                                  {entities.map((entity) => (
                                    <option key={entity.id} value={entity.name}>
                                      {entity.display_name || entity.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ) : null}
                              {connectors.length > 0 ? (
                                <optgroup label="Connectors">
                                  {connectors.map((connector) => (
                                    <option key={connector.id} value={connector.name}>
                                      {connectorOptionLabel(connector)}
                                    </option>
                                  ))}
                                </optgroup>
                              ) : null}
                              {datasourceNames.length === 0 ? (
                                <option value="" disabled>
                                  No datasources yet
                                </option>
                              ) : null}
                            </select>
                            <p className={styles.stubHint}>
                              Sets Items to the selected name (e.g. <code>Weather</code>).
                              Use Edit formula for advanced expressions.
                            </p>
                          </div>
                        ) : null}
                        {hasItems &&
                        (normalizeControlType(selectedControl.control_type) ===
                          "datatable" ||
                          normalizeControlType(selectedControl.control_type) ===
                            "gallery") &&
                        (selectedControl.properties?.showRefresh === undefined ||
                          readPropertyValue(
                            "boolean",
                            selectedControl.properties?.showRefresh,
                          ) === true) ? (
                          <div className={styles.propBlock}>
                            <button
                              type="button"
                              className={styles.formulaEditorBtn}
                              data-testid="property-refresh-data-btn"
                              disabled={
                                refreshingPreview ||
                                !itemsFormula ||
                                (() => {
                                  const sheets = connectors.find(
                                    (c) =>
                                      c.name === itemsFormula &&
                                      isGoogleSheetsConnector(c),
                                  );
                                  return Boolean(
                                    sheets &&
                                      sheetColumnsLoadingByConnectorId[sheets.id],
                                  );
                                })()
                              }
                              onClick={() => {
                                if (!itemsFormula) return;
                                const sheets = connectors.find(
                                  (c) =>
                                    c.name === itemsFormula &&
                                    isGoogleSheetsConnector(c),
                                );
                                setRefreshingPreview(true);
                                const done = () => setRefreshingPreview(false);
                                if (sheets) {
                                  void refreshSheetPreview(sheets.id).finally(done);
                                  return;
                                }
                                if (applicationId) {
                                  void loadEntities(applicationId)
                                    .then(() => loadConnectors(applicationId))
                                    .finally(done);
                                  return;
                                }
                                done();
                              }}
                            >
                              {refreshingPreview ? "Refreshing…" : "Refresh data"}
                            </button>
                            <p className={styles.stubHint}>
                              Reloads designer preview columns/sample rows from the
                              Items datasource. Toggle with{" "}
                              <code>Show Refresh</code> below. Published apps use{" "}
                              <code>Refresh(DataSource)</code> in Power Fx.
                            </p>
                          </div>
                        ) : null}
                        {hasDataSource ? (
                          <div className={styles.propBlock}>
                            <label className={styles.propLabel} htmlFor="form-datasource-picker">
                              Form dataSource
                            </label>
                            <select
                              id="form-datasource-picker"
                              className={styles.datasourceSelect}
                              data-testid="form-datasource-picker"
                              value={
                                datasourceNames.includes(dataSourceValue)
                                  ? dataSourceValue
                                  : ""
                              }
                              onChange={(event) => {
                                const name = event.currentTarget.value;
                                if (!name || !selectedControl) return;
                                updateMetadataProperty(
                                  { name: "dataSource", label: "DataSource", type: "text" },
                                  writePropertyValue("text", name),
                                );
                              }}
                            >
                              <option value="">
                                {dataSourceValue && !datasourceNames.includes(dataSourceValue)
                                  ? `Custom: ${dataSourceValue}`
                                  : "Choose entity or connector…"}
                              </option>
                              {entities.length > 0 ? (
                                <optgroup label="Entities">
                                  {entities.map((entity) => (
                                    <option key={entity.id} value={entity.name}>
                                      {entity.display_name || entity.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ) : null}
                              {connectors.length > 0 ? (
                                <optgroup label="Connectors">
                                  {connectors.map((connector) => (
                                    <option key={connector.id} value={connector.name}>
                                      {connectorOptionLabel(connector)}
                                    </option>
                                  ))}
                                </optgroup>
                              ) : null}
                            </select>
                            <p className={styles.stubHint}>
                              Target for SubmitForm create/update (entity or Google Sheets
                              connector name).
                            </p>
                          </div>
                        ) : null}
                        {hasItem ? (
                          <div className={styles.propBlock}>
                            <label className={styles.propLabel} htmlFor="item-datasource-picker">
                              Item source
                            </label>
                            <select
                              id="item-datasource-picker"
                              className={styles.datasourceSelect}
                              data-testid="item-datasource-picker"
                              value={
                                selectionFormulas.includes(itemFormula) ||
                                datasourceNames.includes(itemFormula)
                                  ? itemFormula
                                  : ""
                              }
                              onChange={(event) => {
                                const name = event.currentTarget.value;
                                if (!name || !selectedControl) return;
                                updateMetadataProperty(
                                  { name: "item", label: "Item", type: "formula" },
                                  writePropertyFormula(name),
                                );
                              }}
                            >
                              <option value="">
                                {itemFormula &&
                                !selectionFormulas.includes(itemFormula) &&
                                !datasourceNames.includes(itemFormula)
                                  ? `Custom: ${itemFormula}`
                                  : "Choose gallery/table selection or datasource…"}
                              </option>
                              {selectionSourceNames.length > 0 ? (
                                <optgroup label="List selection">
                                  {selectionSourceNames.map((name) => (
                                    <option key={name} value={`${name}.Selected`}>
                                      {name}.Selected
                                    </option>
                                  ))}
                                </optgroup>
                              ) : null}
                              {entities.length > 0 ? (
                                <optgroup label="Entities">
                                  {entities.map((entity) => (
                                    <option key={entity.id} value={entity.name}>
                                      {entity.display_name || entity.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ) : null}
                              {connectors.length > 0 ? (
                                <optgroup label="Connectors">
                                  {connectors.map((connector) => (
                                    <option key={connector.id} value={connector.name}>
                                      {connectorOptionLabel(connector)}
                                    </option>
                                  ))}
                                </optgroup>
                              ) : null}
                            </select>
                            <p className={styles.stubHint}>
                              Typically <code>Gallery.Selected</code> or{" "}
                              <code>DataTable.Selected</code> so the form edits the
                              selected row. Dirty Edit/New forms keep unsaved values
                              until Reset or Submit.
                            </p>
                          </div>
                        ) : null}
                        {dataProps
                          .filter((definition) => {
                            if (hasItems && definition.name === "items") return false;
                            if (hasItem && definition.name === "item") return false;
                            if (hasDataSource && definition.name === "dataSource") return false;
                            if (
                              normalizeControlType(selectedControl.control_type) ===
                                "datatable" &&
                              definition.name === "columns"
                            ) {
                              return false;
                            }
                            return true;
                          })
                          .map((definition) => (
                          <MetadataPropRow
                            key={definition.name}
                            definition={definition}
                            groupId={selectedControl.id}
                            value={selectedControl.properties?.[definition.name]}
                            evaluationContext={evaluationContext}
                            onChange={(entry) =>
                              updateMetadataProperty(definition, entry)
                            }
                          />
                        ))}
                        {normalizeControlType(selectedControl.control_type) ===
                        "datatable" ? (
                          <DataTableColumnsPicker
                            selectedControl={selectedControl}
                            itemsFormula={itemsFormula}
                            entities={entities}
                            entityFieldsByEntityId={entityFieldsByEntityId}
                            connectors={connectors}
                            sheetColumnsByConnectorId={sheetColumnsByConnectorId}
                            loadSheetColumns={loadSheetColumns}
                            onWriteColumns={(csv) =>
                              updateMetadataProperty(
                                {
                                  name: "columns",
                                  label: "Columns",
                                  type: "text",
                                },
                                writePropertyValue("text", csv),
                              )
                            }
                          />
                        ) : null}
                        {normalizeControlType(selectedControl.control_type) === "form" &&
                        canGenerateFormFields ? (
                          <div className={styles.propBlock}>
                            <button
                              type="button"
                              className={styles.formulaEditorBtn}
                              data-testid="generate-form-fields-btn"
                              disabled={
                                generatingFields ||
                                (Boolean(resolvedFormEntity) && resolvedFormFieldCount === 0)
                              }
                              onClick={() => {
                                setGeneratingFields(true);
                                void generateFormFields(selectedControl.id).finally(() => {
                                  setGeneratingFields(false);
                                });
                              }}
                            >
                              {generatingFields ? "Generating…" : "Generate fields"}
                            </button>
                            <p className={styles.stubHint}>
                              Creates Label + TextInput children bound to{" "}
                              <code>
                                {resolvedFormEntity?.name ??
                                  resolvedSheetsConnector?.name ??
                                  "datasource"}
                              </code>{" "}
                              {resolvedSheetsConnector
                                ? "sheet columns"
                                : "fields"}{" "}
                              via <code>ThisItem.FieldName</code>.
                            </p>
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
                </PropertyCard>
              )}

              {propertyTab === "actions" && (
                <PropertyCard title="Events">
                  {propertyDefinitions
                    .filter((d) => isActionFormulaProperty(d))
                    .map((definition) => (
                      <MetadataPropRow
                        key={definition.name}
                        definition={definition}
                        groupId={selectedControl.id}
                        value={selectedControl.properties?.[definition.name]}
                        evaluationContext={evaluationContext}
                        onChange={(entry) =>
                          updateMetadataProperty(definition, entry)
                        }
                      />
                    ))}
                </PropertyCard>
              )}
            </>
          ) : selectedScreenId ? (
            <>
              <div className={styles.controlBadge}>
                <span className={styles.controlName}>Selected: {screenName}</span>
              </div>
              {propertyTab === "actions" && (
                <PropertyCard title="Screen Events">
                  <div className={styles.propBlock}>
                    <div className={styles.propRow}>
                      <span className={styles.propLabel}>OnVisible</span>
                      <span className={styles.formulaModeBadge}>Action</span>
                    </div>
                    <div className={styles.formulaSummaryRow}>
                      <span
                        className={styles.formulaSummary}
                        title={onVisibleFormula || undefined}
                        data-testid="on_visible-formula-summary"
                      >
                        {truncateFormula(onVisibleFormula) || "(empty)"}
                      </span>
                    </div>
                    <div className={styles.formulaEditorRow}>
                      <button
                        type="button"
                        className={styles.formulaEditorBtn}
                        data-testid="on_visible-open-formula-editor"
                        onClick={() => setOnVisibleEditorOpen(true)}
                      >
                        Edit formula
                      </button>
                    </div>
                    <FormulaEditorModal
                      open={onVisibleEditorOpen}
                      propertyLabel="OnVisible"
                      initialFormula={onVisibleFormula}
                      validationMode="action"
                      evaluationContext={evaluationContext}
                      onSave={(nextFormula) => {
                        updateScreenOnVisible(selectedScreenId, nextFormula);
                        setOnVisibleEditorOpen(false);
                      }}
                      onCancel={() => setOnVisibleEditorOpen(false)}
                    />
                  </div>
                </PropertyCard>
              )}
              <div className={styles.emptyHint}>
                <p>Select a control on the canvas to view its properties.</p>
              </div>
            </>
          ) : (
            <div className={styles.emptyHint}>
              <p>Select a component to view and edit its properties.</p>
            </div>
          )}
        </div>
        </>
      )}
    </aside>
  );
}
