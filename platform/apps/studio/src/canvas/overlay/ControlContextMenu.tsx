import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ToolboxControlType } from "../../control-defaults";
import { isContainerType } from "../designer/DesignerNode";
import { useInteractionStore } from "../interaction/interactionStore";
import { useApplicationStore } from "../../store/applicationStore";
import { isControlLocked } from "../../utils/control-lock";
import { syncStudioSelection } from "../interaction/syncStudioSelection";
import type { LayerAction } from "../../utils/layer-actions";
import styles from "./ControlContextMenu.module.css";

const LAYER_ITEMS: Array<{ action: LayerAction; label: string }> = [
  { action: "bringToFront", label: "To Front" },
  { action: "bringForward", label: "Forward" },
  { action: "sendBackward", label: "Backward" },
  { action: "sendToBack", label: "To back" },
];

const INSERT_TYPES: Array<{ type: ToolboxControlType; label: string }> = [
  { type: "button", label: "Button" },
  { type: "label", label: "Label" },
  { type: "textinput", label: "Text Input" },
  { type: "checkbox", label: "Checkbox" },
  { type: "toggle", label: "Toggle" },
  { type: "dropdown", label: "Dropdown" },
  { type: "image", label: "Image" },
  { type: "container", label: "Container" },
];

function IconLock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function IconDuplicate() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="8" y="8" width="12" height="12" rx="1" />
      <path d="M4 16V5a1 1 0 0 1 1-1h11" />
    </svg>
  );
}

function IconRemove() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l9 5-9 5-9-5 9-5z" />
      <path d="M3 12l9 5 9-5" />
      <path d="M3 17l9 5 9-5" />
    </svg>
  );
}

function IconNest() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </svg>
  );
}

export function ControlContextMenu() {
  const contextMenu = useInteractionStore((s) => s.contextMenu);
  const closeContextMenu = useInteractionStore((s) => s.closeContextMenu);
  const controls = useApplicationStore((s) => s.controls);
  const applyLayerAction = useApplicationStore((s) => s.applyLayerAction);
  const setControlLocked = useApplicationStore((s) => s.setControlLocked);
  const duplicateControl = useApplicationStore((s) => s.duplicateControl);
  const deleteControl = useApplicationStore((s) => s.deleteControl);
  const createControl = useApplicationStore((s) => s.createControl);
  const updateControl = useApplicationStore((s) => s.updateControl);

  const [layerOpen, setLayerOpen] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [nestOpen, setNestOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const control = contextMenu
    ? controls.find((item) => item.id === contextMenu.controlId)
    : null;
  const locked = isControlLocked(control);
  const isContainer = control ? isContainerType(control.control_type) : false;
  const containerTargets = controls.filter(
    (item) =>
      isContainerType(item.control_type) &&
      item.id !== control?.id &&
      item.screen_id === control?.screen_id,
  );

  useEffect(() => {
    if (!contextMenu) {
      setLayerOpen(false);
      setInsertOpen(false);
      setNestOpen(false);
    }
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        closeContextMenu();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeContextMenu();
    };
    const onScroll = () => closeContextMenu();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [contextMenu, closeContextMenu]);

  if (!contextMenu || !control) {
    return null;
  }

  const close = () => closeContextMenu();

  const menu = (
    <div
      ref={rootRef}
      className={styles.menu}
      data-testid="control-context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      role="menu"
    >
      <button
        type="button"
        className={styles.item}
        role="menuitem"
        onClick={() => {
          setControlLocked(control.id, !locked);
          close();
        }}
      >
        <span className={styles.icon}>
          <IconLock />
        </span>
        {locked ? "Unlock" : "Lock"}
      </button>

      <button
        type="button"
        className={styles.item}
        role="menuitem"
        onClick={() => {
          const id = duplicateControl(control.id);
          if (id) {
            useInteractionStore.getState().select(id);
            syncStudioSelection();
          }
          close();
        }}
      >
        <span className={styles.icon}>
          <IconDuplicate />
        </span>
        Duplicate
      </button>

      <button
        type="button"
        className={styles.item}
        role="menuitem"
        onClick={() => {
          void deleteControl(control.id).then(() => {
            useInteractionStore.getState().clearSelection();
            syncStudioSelection();
            close();
          });
        }}
      >
        <span className={styles.icon}>
          <IconRemove />
        </span>
        Remove
      </button>

      <div
        className={styles.itemRow}
        onMouseEnter={() => {
          setLayerOpen(true);
          setInsertOpen(false);
          setNestOpen(false);
        }}
        onMouseLeave={() => setLayerOpen(false)}
      >
        <button type="button" className={`${styles.item} ${styles.itemHasSub}`} role="menuitem">
          <span className={styles.icon}>
            <IconLayers />
          </span>
          Layering
          <span className={styles.chevron}>›</span>
        </button>
        {layerOpen ? (
          <div className={styles.submenu} role="menu" data-testid="context-layering-submenu">
            {LAYER_ITEMS.map((item) => (
              <button
                key={item.action}
                type="button"
                className={styles.item}
                role="menuitem"
                onClick={() => {
                  applyLayerAction(control.id, item.action);
                  close();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {isContainer ? (
        <div
          className={styles.itemRow}
          onMouseEnter={() => {
            setInsertOpen(true);
            setLayerOpen(false);
            setNestOpen(false);
          }}
          onMouseLeave={() => setInsertOpen(false)}
        >
          <button type="button" className={`${styles.item} ${styles.itemHasSub}`} role="menuitem">
            <span className={styles.icon}>
              <IconNest />
            </span>
            Insert into Container
            <span className={styles.chevron}>›</span>
          </button>
          {insertOpen ? (
            <div className={styles.submenu} role="menu" data-testid="context-insert-submenu">
              {INSERT_TYPES.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  className={styles.item}
                  role="menuitem"
                  onClick={() => {
                    const siblings = controls.filter(
                      (c) => c.parent_control_id === control.id,
                    );
                    const offset = (siblings.length % 6) * 16;
                    createControl(item.type, {
                      parent_control_id: control.id,
                      x: 12 + offset,
                      y: 12 + offset,
                    });
                    useInteractionStore.getState().enterContainerEdit(control.id);
                    syncStudioSelection();
                    close();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {!isContainer && containerTargets.length > 0 ? (
        <div
          className={styles.itemRow}
          onMouseEnter={() => {
            setNestOpen(true);
            setLayerOpen(false);
            setInsertOpen(false);
          }}
          onMouseLeave={() => setNestOpen(false)}
        >
          <button type="button" className={`${styles.item} ${styles.itemHasSub}`} role="menuitem">
            <span className={styles.icon}>
              <IconNest />
            </span>
            Nest into Container
            <span className={styles.chevron}>›</span>
          </button>
          {nestOpen ? (
            <div className={styles.submenu} role="menu" data-testid="context-nest-submenu">
              {containerTargets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  className={styles.item}
                  role="menuitem"
                  onClick={() => {
                    const siblings = controls.filter(
                      (c) => c.parent_control_id === target.id,
                    );
                    const offset = (siblings.length % 6) * 16;
                    updateControl(control.id, {
                      parent_control_id: target.id,
                      x: 12 + offset,
                      y: 12 + offset,
                    });
                    useInteractionStore.getState().enterContainerEdit(target.id);
                    useInteractionStore.getState().select(control.id);
                    syncStudioSelection();
                    close();
                  }}
                >
                  {target.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return createPortal(menu, document.body);
}
