import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ToolboxControlType } from "../../control-defaults";
import { isContainerType } from "../../canvas/designer/DesignerNode";
import { useInteractionStore } from "../../canvas/interaction/interactionStore";
import { useApplicationStore } from "../../store/applicationStore";
import { useStudioStore } from "../../store/studioStore";
import styles from "./ToolsFooter.module.css";

const TOOL_ICON: Record<ToolboxControlType, ReactNode> = {
  textinput: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7V4h16v3" />
      <path d="M9 20h6" />
      <path d="M12 4v16" />
    </svg>
  ),
  label: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16" />
      <path d="M4 12h10" />
      <path d="M4 17h14" />
    </svg>
  ),
  gallery: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  datatable: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M3 10h18" />
      <path d="M3 15h18" />
      <path d="M9 5v14" />
    </svg>
  ),
  form: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  button: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="8" width="18" height="8" rx="2" />
    </svg>
  ),
  timer: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2" />
      <path d="M9 2h6" />
    </svg>
  ),
  dropdown: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M8 10h8" />
      <path d="M14 14l2 2 2-2" />
    </svg>
  ),
  container: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
    </svg>
  ),
  checkbox: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <path d="M7 12l3 3 6-6" />
    </svg>
  ),
  toggle: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="10" rx="5" />
      <circle cx="8" cy="12" r="3" fill="currentColor" />
    </svg>
  ),
  image: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10.5" r="1.5" />
      <path d="M21 17l-5-5L5 19" />
    </svg>
  ),
  icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z" />
    </svg>
  ),
  datepicker: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M3 11h18" />
    </svg>
  ),
  shape_rectangle: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="6" width="16" height="12" />
    </svg>
  ),
  shape_ellipse: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="12" rx="8" ry="5" />
    </svg>
  ),
  shape_line: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  ),
  shape_arrow: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="12" x2="18" y2="12" />
      <polyline points="14 8 18 12 14 16" />
    </svg>
  ),
  shape_image: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="5" width="16" height="14" rx="1" strokeDasharray="3 2" />
    </svg>
  ),
  shape_star: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l2.2 6.8H21l-5.5 4 2.1 6.7L12 16.5 6.4 20.5l2.1-6.7L3 9.8h6.8z" />
    </svg>
  ),
};

const HTML_TOOL_ITEMS: Array<{ type: ToolboxControlType; label: string }> = [
  { type: "textinput", label: "Text Input" },
  { type: "label", label: "Label" },
  { type: "dropdown", label: "Dropdown" },
  { type: "checkbox", label: "Checkbox" },
  { type: "toggle", label: "Toggle" },
  { type: "datepicker", label: "Date Picker" },
  { type: "button", label: "Button" },
  { type: "gallery", label: "Gallery" },
  { type: "datatable", label: "Data Table" },
  { type: "form", label: "Form" },
  { type: "container", label: "Container" },
  { type: "image", label: "Image" },
  { type: "icon", label: "Icon" },
  { type: "timer", label: "Timer" },
];

const SHAPE_TOOL_ITEMS: Array<{ type: ToolboxControlType; label: string }> = [
  { type: "shape_rectangle", label: "Rectangle" },
  { type: "shape_ellipse", label: "Ellipse" },
  { type: "shape_line", label: "Line" },
  { type: "shape_arrow", label: "Arrow" },
  { type: "shape_image", label: "Shape Image" },
  { type: "shape_star", label: "Star" },
];

const SHAPES_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="8" height="8" />
    <circle cx="17" cy="8" r="4" />
    <path d="M5 20l4-6 4 6H5z" />
  </svg>
);

/** Resolve Form/Gallery/Container (or container-edit) to nest newly created controls. */
export function resolveInsertParentId(): string | null {
  const containerEditId = useInteractionStore.getState().containerEditId;
  if (containerEditId) {
    return containerEditId;
  }

  const selectedId = useStudioStore.getState().selectedControlId;
  if (!selectedId) {
    return null;
  }

  const controls = useApplicationStore.getState().controls;
  const selected = controls.find((item) => item.id === selectedId);
  if (!selected) {
    return null;
  }

  if (isContainerType(selected.control_type)) {
    return selected.id;
  }

  if (selected.parent_control_id) {
    const parent = controls.find((item) => item.id === selected.parent_control_id);
    if (parent && isContainerType(parent.control_type)) {
      return parent.id;
    }
  }

  return null;
}

function createNestedControl(type: ToolboxControlType) {
  const createControl = useApplicationStore.getState().createControl;
  const parentId = resolveInsertParentId();
  if (parentId) {
    const siblings = useApplicationStore
      .getState()
      .controls.filter((item) => item.parent_control_id === parentId);
    const offset = (siblings.length % 6) * 16;
    createControl(type, {
      parent_control_id: parentId,
      x: 12 + offset,
      y: 12 + offset,
    });
    return;
  }
  createControl(type);
}

function ToolButton({
  type,
  label,
  disabled,
}: {
  type: ToolboxControlType;
  label: string;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      className={styles.toolBtn}
      disabled={disabled}
      title={label}
      aria-label={label}
      draggable={!disabled}
      onDragStart={(e) => {
        if (disabled) return;
        e.dataTransfer.setData("application/goapps-control", type);
      }}
      onClick={() => {
        if (!disabled) createNestedControl(type);
      }}
    >
      <span className={styles.toolIcon}>{TOOL_ICON[type]}</span>
    </button>
  );
}

function ShapesFlyout({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number } | null>(
    null,
  );
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || disabled) {
      setMenuPos(null);
      return;
    }
    const update = () => {
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPos({
        left: rect.left + rect.width / 2,
        bottom: window.innerHeight - rect.top + 8,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, disabled]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu =
    open && !disabled && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            className={styles.shapesMenu}
            role="menu"
            data-testid="shapes-flyout-menu"
            style={{ left: menuPos.left, bottom: menuPos.bottom }}
          >
            {SHAPE_TOOL_ITEMS.map((item) => (
              <button
                key={item.type}
                type="button"
                className={styles.shapesMenuItem}
                role="menuitem"
                title={item.label}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/goapps-control", item.type);
                  setOpen(false);
                }}
                onClick={() => {
                  createNestedControl(item.type);
                  setOpen(false);
                }}
              >
                <span className={styles.toolIcon}>{TOOL_ICON[item.type]}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={styles.shapesWrap}>
      <button
        ref={btnRef}
        type="button"
        className={`${styles.toolBtn} ${open ? styles.toolBtnActive : ""}`}
        disabled={disabled}
        title="Shapes"
        aria-label="Shapes"
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="shapes-flyout-btn"
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
      >
        <span className={styles.toolIcon}>{SHAPES_ICON}</span>
      </button>
      {menu}
    </div>
  );
}

export function ToolsFooter() {
  const selectedScreenId = useApplicationStore((s) => s.selectedScreenId);
  const disabled = !selectedScreenId;

  return (
    <footer className={styles.footer}>
      <div className={styles.tools} data-testid="tools-footer-row">
        {HTML_TOOL_ITEMS.map((item) => (
          <ToolButton
            key={item.type}
            type={item.type}
            label={item.label}
            disabled={disabled}
          />
        ))}
        <ShapesFlyout disabled={disabled} />
      </div>
      {disabled ? (
        <span className={styles.hint}>Select a screen to add controls</span>
      ) : null}
    </footer>
  );
}
