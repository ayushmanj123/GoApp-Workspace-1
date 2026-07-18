import type { ToolboxControlType } from "../../control-defaults";
import { useApplicationStore } from "../../store/applicationStore";
import styles from "./ToolboxPanel.module.css";

const TOOLBOX_ITEMS: Array<{ type: ToolboxControlType; label: string; icon: string }> =
  [
    { type: "button", label: "Button", icon: "B" },
    { type: "textinput", label: "Input", icon: "T" },
    { type: "gallery", label: "Gallery", icon: "G" },
    { type: "label", label: "Label", icon: "L" },
    { type: "form", label: "Form", icon: "F" },
    { type: "timer", label: "Timer", icon: "⏱" },
  ];

interface ToolboxPanelProps {
  onDragStart?: (type: ToolboxControlType) => void;
}

export function ToolboxPanel({ onDragStart }: ToolboxPanelProps) {
  const selectedScreenId = useApplicationStore((s) => s.selectedScreenId);
  const createControl = useApplicationStore((s) => s.createControl);

  if (!selectedScreenId) {
    return <div className={styles.hint}>Select a screen to add controls.</div>;
  }

  return (
    <div>
      <div className={styles.sectionHeader}>Library</div>
      <div className={styles.grid}>
        {TOOLBOX_ITEMS.map((item) => (
          <button
            key={item.type}
            type="button"
            className={styles.card}
            aria-label={`Add ${item.label}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/goapps-control", item.type);
              onDragStart?.(item.type);
            }}
            onClick={() => createControl(item.type)}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
