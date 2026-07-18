import type { ReactNode } from "react";
import { IconChevronRight, IconEye, IconLock } from "./icons";
import styles from "./TreeRow.module.css";

interface TreeRowProps {
  label: string;
  depth?: number;
  selected?: boolean;
  expanded?: boolean;
  hasChildren?: boolean;
  hidden?: boolean;
  locked?: boolean;
  icon?: ReactNode;
  onClick?: () => void;
  onToggle?: () => void;
  onToggleVisibility?: () => void;
  onToggleLock?: () => void;
}

export function TreeRow({
  label,
  depth = 0,
  selected = false,
  expanded = false,
  hasChildren = false,
  hidden = false,
  locked = false,
  icon,
  onClick,
  onToggle,
  onToggleVisibility,
  onToggleLock,
}: TreeRowProps) {
  return (
    <div
      className={[styles.row, selected ? styles.selected : "", hidden ? styles.hidden : ""]
        .filter(Boolean)
        .join(" ")}
      style={{ paddingLeft: `calc(${depth * 12}px + var(--space-2))` }}
      onClick={onClick}
      role="treeitem"
      aria-selected={selected}
    >
      {hasChildren ? (
        <button
          type="button"
          className={styles.chevron}
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <span style={{ transform: expanded ? "rotate(90deg)" : "none", display: "flex" }}>
            <IconChevronRight size={12} />
          </span>
        </button>
      ) : (
        <span className={styles.chevronPlaceholder} />
      )}
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <span className={styles.label}>{label}</span>
      <span className={styles.actions}>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility?.();
          }}
          aria-label="Toggle visibility"
        >
          <IconEye size={11} />
        </button>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock?.();
          }}
          aria-label="Toggle lock"
        >
          <IconLock size={11} />
        </button>
      </span>
    </div>
  );
}
