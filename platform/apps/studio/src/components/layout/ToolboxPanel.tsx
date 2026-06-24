import type { ToolboxControlType } from "../../control-defaults";
import { useApplicationStore } from "../../store/applicationStore";
import styles from "./ToolboxPanel.module.css";

const TOOLBOX_ITEMS: Array<{ type: ToolboxControlType; label: string; icon: string }> =
  [
    { type: "button", label: "Button", icon: "B" },
    { type: "label", label: "Label", icon: "L" },
    { type: "textinput", label: "Text Input", icon: "T" },
    { type: "gallery", label: "Gallery", icon: "G" },
    { type: "form", label: "Form", icon: "F" },
    { type: "timer", label: "Timer", icon: "⏱" },
  ];

export function ToolboxPanel() {
  const selectedScreenId = useApplicationStore((s) => s.selectedScreenId);
  const createControl = useApplicationStore((s) => s.createControl);

  return (
    <div className={styles.toolboxSection}>
      <div className={styles.sectionHeader}>
        <span>Toolbox</span>
      </div>

      {!selectedScreenId ? (
        <div className={styles.hint}>Select a screen to add controls.</div>
      ) : (
        <ul className={styles.toolList}>
          {TOOLBOX_ITEMS.map((item) => (
            <li key={item.type}>
              <button
                type="button"
                className={styles.toolBtn}
                aria-label={`Add ${item.label}`}
                onClick={() => createControl(item.type)}
              >
                <span className={styles.toolIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
