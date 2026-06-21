import type { ChangeEvent } from "react";
import type { Control } from "../../api/controls-api";
import { useStudioStore } from "../../store/studioStore";
import { useApplicationStore } from "../../store/applicationStore";
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
  type?: "text" | "number";
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

function readTextValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.value === "string") {
      return record.value;
    }
    if (typeof record.value === "number") {
      return String(record.value);
    }
  }
  return "";
}

export function PropertyPanel() {
  const collapsed = useStudioStore((s) => s.propertiesCollapsed);
  const toggleProperties = useStudioStore((s) => s.toggleProperties);
  const selectedControlId = useStudioStore((s) => s.selectedControlId);
  const controls = useApplicationStore((s) => s.controls);
  const updateControl = useApplicationStore((s) => s.updateControl);

  const selectedControl = controls.find(
    (control) => control.id === selectedControlId,
  );
  const controlText = selectedControl
    ? readTextValue(selectedControl.properties?.text)
    : "";

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

  const updateText = (nextValue: string) => {
    if (!selectedControl) return;
    updateControl(selectedControl.id, {
      properties: {
        ...(selectedControl.properties ?? {}),
        text: nextValue,
      },
    });
  };

  return (
    <aside className={`${styles.panel} ${collapsed ? styles.collapsed : ""}`}>
      {/* Header */}
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
              <PropRow label="Text" value={controlText} onChange={updateText} />
            </>
          ) : (
            <div className={styles.emptyHint}>
              <p>Select a control on the canvas to view its properties.</p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
