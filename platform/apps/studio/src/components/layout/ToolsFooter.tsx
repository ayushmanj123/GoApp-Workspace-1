import type { ToolboxControlType } from "../../control-defaults";
import { useApplicationStore } from "../../store/applicationStore";
import styles from "./ToolsFooter.module.css";

const TOOL_ITEMS: Array<{
  type: ToolboxControlType;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    type: "textinput",
    label: "Text Input",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7V4h16v3" />
        <path d="M9 20h6" />
        <path d="M12 4v16" />
      </svg>
    ),
  },
  {
    type: "label",
    label: "Label",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7h16" />
        <path d="M4 12h10" />
        <path d="M4 17h14" />
      </svg>
    ),
  },
  {
    type: "gallery",
    label: "Gallery",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    type: "form",
    label: "Form",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    type: "button",
    label: "Button",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="8" width="18" height="8" rx="2" />
      </svg>
    ),
  },
];

export function ToolsFooter() {
  const selectedScreenId = useApplicationStore((s) => s.selectedScreenId);
  const createControl = useApplicationStore((s) => s.createControl);
  const disabled = !selectedScreenId;

  return (
    <footer className={styles.footer}>
      <div className={styles.tools}>
        {TOOL_ITEMS.map((item) => (
          <button
            key={item.type}
            type="button"
            className={styles.toolBtn}
            disabled={disabled}
            aria-label={`Add ${item.label}`}
            draggable={!disabled}
            onDragStart={(e) => {
              if (disabled) return;
              e.dataTransfer.setData("application/goapps-control", item.type);
            }}
            onClick={() => {
              if (!disabled) createControl(item.type);
            }}
          >
            <span className={styles.toolIcon}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
      {disabled ? (
        <span className={styles.hint}>Select a screen to add controls</span>
      ) : null}
    </footer>
  );
}
