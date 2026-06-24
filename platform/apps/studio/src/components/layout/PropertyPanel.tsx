import { type ChangeEvent, useState } from "react";
import type { Control } from "../../api/controls-api";
import { FormulaEditorModal } from "../formula/FormulaEditorModal";
import {
  getPropertyDefinitions,
  isFormulaOnly,
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

function PropRow({ label, type = "text", value, onChange }: PropRowProps) {
  return (
    <div className={styles.propRow}>
      <label className={styles.propLabel}>{label}</label>
      <input
        className={styles.propInput}
        type={type}
        aria-label={label}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.currentTarget.value)
        }
      />
    </div>
  );
}

interface MetadataPropRowProps {
  definition: PropertyFieldDefinition;
  value: unknown;
  evaluationContext: Record<string, unknown>;
  onChange: (entry: Record<string, unknown>) => void;
}

function PropertyModeSelector({
  definition,
  mode,
  onModeChange,
}: {
  definition: PropertyFieldDefinition;
  mode: PropertyMode;
  onModeChange: (mode: PropertyMode) => void;
}) {
  return (
    <div className={styles.propModeRow}>
      <label className={styles.modeOption}>
        <input
          type="radio"
          name={`${definition.name}-mode`}
          checked={mode === "static"}
          data-testid={`${definition.name}-mode-static`}
          onChange={() => onModeChange("static")}
        />
        Static
      </label>
      <label className={styles.modeOption}>
        <input
          type="radio"
          name={`${definition.name}-mode`}
          checked={mode === "formula"}
          data-testid={`${definition.name}-mode-formula`}
          onChange={() => onModeChange("formula")}
        />
        Formula
      </label>
    </div>
  );
}

function MetadataPropRow({
  definition,
  value,
  evaluationContext,
  onChange,
}: MetadataPropRowProps) {
  const { label, type } = definition;
  const formulaCapable = supportsFormulaMode(definition);
  const mode = getPropertyMode(value);
  const [editorOpen, setEditorOpen] = useState(false);

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
    return (
      <div className={styles.propBlock}>
        <div className={styles.propRow}>
          <span className={styles.propLabel}>{label}</span>
          <span className={styles.formulaModeBadge}>Action</span>
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
            onClick={() => setEditorOpen(true)}
          >
            Open Formula Editor
          </button>
        </div>
        <FormulaEditorModal
          open={editorOpen}
          propertyLabel={label}
          initialFormula={formula}
          validationMode="action"
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
    );
  }

  if (type === "number") {
    const numeric = readPropertyValue("number", value);
    return (
      <PropRow
        label={label}
        type="number"
        value={String(numeric)}
        onChange={(nextValue) => {
          const parsed = Number(nextValue);
          if (Number.isFinite(parsed)) {
            onChange(writePropertyValue("number", parsed));
          }
        }}
      />
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
          onModeChange={handleModeChange}
        />
        <div className={styles.formulaEditorRow}>
          <button
            type="button"
            className={styles.formulaEditorBtn}
            data-testid={`${definition.name}-open-formula-editor`}
            onClick={() => setEditorOpen(true)}
          >
            Open Formula Editor
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
          onModeChange={handleModeChange}
        />
      )}
    </div>
  );
}

export function PropertyPanel() {
  const collapsed = useStudioStore((s) => s.propertiesCollapsed);
  const toggleProperties = useStudioStore((s) => s.toggleProperties);
  const selectedControlId = useStudioStore((s) => s.selectedControlId);
  const appName = useStudioStore((s) => s.appName);
  const screenName = useStudioStore((s) => s.screenName);
  const controls = useApplicationStore((s) => s.controls);
  const selectedScreenId = useApplicationStore((s) => s.selectedScreenId);
  const screens = useApplicationStore((s) => s.screens);
  const updateControl = useApplicationStore((s) => s.updateControl);
  const updateScreenOnVisible = useApplicationStore((s) => s.updateScreenOnVisible);
  const deleteControl = useApplicationStore((s) => s.deleteControl);
  const [onVisibleEditorOpen, setOnVisibleEditorOpen] = useState(false);

  const selectedControl = controls.find(
    (control) => control.id === selectedControlId,
  );
  const selectedScreen = screens.find((screen) => screen.id === selectedScreenId);
  const onVisibleFormula = selectedScreen?.on_visible ?? "";
  const propertyDefinitions = selectedControl
    ? getPropertyDefinitions(selectedControl.control_type)
    : [];
  const evaluationContext = buildStudioFormulaContext(appName, controls);

  const updateNumericField = (
    field: "x" | "y" | "width" | "height",
    nextValue: string,
  ) => {
    if (!selectedControl) {
      return;
    }

    const parsed = Number(nextValue);
    if (!Number.isFinite(parsed)) {
      return;
    }

    const next: Partial<Pick<Control, "x" | "y" | "width" | "height">> = {
      [field]: parsed,
    } as Partial<Pick<Control, "x" | "y" | "width" | "height">>;
    updateControl(selectedControl.id, next);
  };

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
        <div className={styles.content}>
          {selectedControl ? (
            <>
              <div className={styles.controlBadge}>
                <span className={styles.controlName}>
                  {selectedControl.name}
                </span>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => void deleteControl(selectedControl.id)}
                >
                  Delete
                </button>
              </div>

              <PropRow
                label="Name"
                value={selectedControl.name}
                onChange={updateName}
              />
              <PropRow
                label="X"
                type="number"
                value={String(selectedControl.x)}
                onChange={(value) => updateNumericField("x", value)}
              />
              <PropRow
                label="Y"
                type="number"
                value={String(selectedControl.y)}
                onChange={(value) => updateNumericField("y", value)}
              />
              <PropRow
                label="Width"
                type="number"
                value={String(selectedControl.width)}
                onChange={(value) => updateNumericField("width", value)}
              />
              <PropRow
                label="Height"
                type="number"
                value={String(selectedControl.height)}
                onChange={(value) => updateNumericField("height", value)}
              />

              {propertyDefinitions.map((definition) => (
                <MetadataPropRow
                  key={definition.name}
                  definition={definition}
                  value={selectedControl.properties?.[definition.name]}
                  evaluationContext={evaluationContext}
                  onChange={(entry) =>
                    updateMetadataProperty(definition, entry)
                  }
                />
              ))}
            </>
          ) : selectedScreenId ? (
            <>
              <div className={styles.controlBadge}>
                <span className={styles.controlName}>{screenName}</span>
              </div>
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
                    Open Formula Editor
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
              <div className={styles.emptyHint}>
                <p>Select a control on the canvas to view its properties.</p>
              </div>
            </>
          ) : (
            <div className={styles.emptyHint}>
              <p>Select a screen to view screen properties.</p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
