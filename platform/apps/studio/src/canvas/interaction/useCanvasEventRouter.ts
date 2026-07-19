import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useApplicationStore } from "../../store/applicationStore";
import { type ArtboardOffset } from "../CoordinateSystem";
import type { DesignerNode } from "../designer/DesignerNode";
import { findDesignerNode } from "../designer/DesignerNodeRegistry";
import {
  hitTestAtPoint,
  hitTestContainerAtPoint,
  hitTestInRect,
} from "./HitTestService";
import { useInteractionStore } from "./interactionStore";
import { clampPositionToArtboard } from "./artboardClamp";
import { snapPosition } from "./snapGuides";
import { syncStudioSelection } from "./syncStudioSelection";
import { isEditableKeyboardTarget } from "../../utils/editable-keyboard-target";
import { isControlLocked } from "../../utils/control-lock";

const DOUBLE_CLICK_MS = 400;

function normalizeRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/**
 * Unified pointer + keyboard routing for the designer canvas.
 */
export function useCanvasEventRouter(
  containerRef: RefObject<HTMLDivElement | null>,
  nodes: DesignerNode[],
  offset: ArtboardOffset,
  zoom: number,
): {
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: () => void;
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
} {
  const updateControl = useApplicationStore((s) => s.updateControl);
  const deleteControl = useApplicationStore((s) => s.deleteControl);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastClickRef = useRef<{ controlId: string; time: number } | null>(null);
  /** Shift-snap preference for the active drag (updated on each move). */
  const shiftSnapRef = useRef(false);

  const toArtboardPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) {
        return { x: 0, y: 0 };
      }
      const rect = el.getBoundingClientRect();
      const scale = zoom / 100;
      return {
        x: (clientX - rect.left - offset.stageX) / scale,
        y: (clientY - rect.top - offset.stageY) / scale,
      };
    },
    [containerRef, offset.stageX, offset.stageY, zoom],
  );

  const applyDragPosition = useCallback(
    (node: DesignerNode, absoluteX: number, absoluteY: number, snap: boolean) => {
      let nextX = absoluteX;
      let nextY = absoluteY;

      if (snap) {
        const snapped = snapPosition(
          nodes,
          node.controlId,
          absoluteX,
          absoluteY,
          node.absoluteBounds.width,
          node.absoluteBounds.height,
        );
        useInteractionStore.getState().setAlignmentGuides(snapped.guides);
        nextX = snapped.x;
        nextY = snapped.y;
      } else {
        useInteractionStore.getState().setAlignmentGuides([]);
      }

      const clamped = clampPositionToArtboard(
        nextX,
        nextY,
        node.absoluteBounds.width,
        node.absoluteBounds.height,
      );

      const parent = node.parentId ? findDesignerNode(nodes, node.parentId) : null;
      const localX = parent ? clamped.x - parent.absoluteBounds.x : clamped.x;
      const localY = parent ? clamped.y - parent.absoluteBounds.y : clamped.y;

      updateControl(node.controlId, {
        x: Math.round(localX),
        y: Math.round(localY),
      });

      return clamped;
    },
    [nodes, updateControl],
  );

  const updateReparentDropTarget = useCallback(
    (
      node: DesignerNode,
      absoluteX: number,
      absoluteY: number,
      containerEditId: string | null,
    ) => {
      const centerX = absoluteX + node.absoluteBounds.width / 2;
      const centerY = absoluteY + node.absoluteBounds.height / 2;
      const target = hitTestContainerAtPoint(nodes, centerX, centerY, {
        containerEditId,
        excludeControlId: node.controlId,
      });
      useInteractionStore.getState().setDropTarget(target?.controlId ?? null);
      return target;
    },
    [nodes],
  );

  const commitReparent = useCallback(
    (
      node: DesignerNode,
      absoluteX: number,
      absoluteY: number,
      containerEditId: string | null,
      snap: boolean,
    ) => {
      let nextX = absoluteX;
      let nextY = absoluteY;
      if (snap) {
        const snapped = snapPosition(
          nodes,
          node.controlId,
          absoluteX,
          absoluteY,
          node.absoluteBounds.width,
          node.absoluteBounds.height,
        );
        nextX = snapped.x;
        nextY = snapped.y;
      }

      const clamped = clampPositionToArtboard(
        nextX,
        nextY,
        node.absoluteBounds.width,
        node.absoluteBounds.height,
      );

      const target = hitTestContainerAtPoint(
        nodes,
        clamped.x + node.absoluteBounds.width / 2,
        clamped.y + node.absoluteBounds.height / 2,
        {
          containerEditId,
          excludeControlId: node.controlId,
        },
      );

      const nextParentId = target?.controlId ?? null;
      const prevParentId = node.parentId ?? null;

      if (nextParentId === prevParentId) {
        const parent = prevParentId ? findDesignerNode(nodes, prevParentId) : null;
        updateControl(node.controlId, {
          x: Math.round(parent ? clamped.x - parent.absoluteBounds.x : clamped.x),
          y: Math.round(parent ? clamped.y - parent.absoluteBounds.y : clamped.y),
        });
        return;
      }

      if (target) {
        updateControl(node.controlId, {
          parent_control_id: target.controlId,
          x: Math.round(Math.max(0, clamped.x - target.absoluteBounds.x)),
          y: Math.round(Math.max(0, clamped.y - target.absoluteBounds.y)),
        });
      } else {
        updateControl(node.controlId, {
          parent_control_id: null,
          x: Math.round(clamped.x),
          y: Math.round(clamped.y),
        });
      }
    },
    [nodes, updateControl],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target)) {
        return;
      }

      const state = useInteractionStore.getState();

      if (event.key === "Escape") {
        if (state.contextMenu) {
          state.closeContextMenu();
          return;
        }
        if (state.containerEditId) {
          state.exitContainerEdit();
          state.setHovered(null);
          syncStudioSelection();
        } else {
          state.clearSelection();
          state.setHovered(null);
          syncStudioSelection();
        }
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        const id = state.primaryControlId;
        if (!id) {
          return;
        }
        const control = useApplicationStore.getState().controls.find((c) => c.id === id);
        if (isControlLocked(control)) {
          return;
        }
        event.preventDefault();
        void deleteControl(id).then(() => {
          useInteractionStore.getState().clearSelection();
          syncStudioSelection();
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteControl]);

  const onContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      const point = toArtboardPoint(event.clientX, event.clientY);
      const containerEditId = useInteractionStore.getState().containerEditId;
      const hit = hitTestAtPoint(nodes, point.x, point.y, { containerEditId });
      if (!hit) {
        useInteractionStore.getState().closeContextMenu();
        return;
      }
      useInteractionStore.getState().openContextMenu(hit.controlId, event.clientX, event.clientY);
      syncStudioSelection();
    },
    [nodes, toArtboardPoint],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target.dataset.resizeHandle === "true") {
        return;
      }

      useInteractionStore.getState().closeContextMenu();

      const point = toArtboardPoint(event.clientX, event.clientY);
      const containerEditId = useInteractionStore.getState().containerEditId;
      const hit = hitTestAtPoint(nodes, point.x, point.y, { containerEditId });

      if (hit) {
        const now = Date.now();
        const last = lastClickRef.current;
        if (
          last &&
          last.controlId === hit.controlId &&
          now - last.time < DOUBLE_CLICK_MS &&
          hit.isContainer
        ) {
          useInteractionStore.getState().enterContainerEdit(hit.controlId);
          syncStudioSelection();
          lastClickRef.current = null;
          event.preventDefault();
          return;
        }
        lastClickRef.current = { controlId: hit.controlId, time: now };

        const additive = event.shiftKey;
        useInteractionStore.getState().select(hit.controlId, { additive });
        syncStudioSelection();

        if (hit.draggable) {
          shiftSnapRef.current = event.shiftKey;
          useInteractionStore
            .getState()
            .beginDrag(hit.controlId, point, {
              x: hit.absoluteBounds.x,
              y: hit.absoluteBounds.y,
            });
          (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);

          const onMove = (ev: PointerEvent) => {
            const dragState = useInteractionStore.getState();
            if (!dragState.draggingControlId || !dragState.dragOrigin || !dragState.dragStartPointer) {
              return;
            }
            shiftSnapRef.current = ev.shiftKey;
            const current = toArtboardPoint(ev.clientX, ev.clientY);
            const dx = current.x - dragState.dragStartPointer.x;
            const dy = current.y - dragState.dragStartPointer.y;
            const node = findDesignerNode(nodes, dragState.draggingControlId);
            if (!node) {
              return;
            }
            const absX = dragState.dragOrigin.x + dx;
            const absY = dragState.dragOrigin.y + dy;
            applyDragPosition(node, absX, absY, ev.shiftKey);
            updateReparentDropTarget(node, absX, absY, dragState.containerEditId);
          };

          const onUp = (ev: PointerEvent) => {
            const dragState = useInteractionStore.getState();
            if (dragState.draggingControlId && dragState.dragOrigin && dragState.dragStartPointer) {
              const current = toArtboardPoint(ev.clientX, ev.clientY);
              const dx = current.x - dragState.dragStartPointer.x;
              const dy = current.y - dragState.dragStartPointer.y;
              const node = findDesignerNode(nodes, dragState.draggingControlId);
              if (node) {
                commitReparent(
                  node,
                  dragState.dragOrigin.x + dx,
                  dragState.dragOrigin.y + dy,
                  dragState.containerEditId,
                  ev.shiftKey || shiftSnapRef.current,
                );
              }
            }
            useInteractionStore.getState().endDrag();
            (event.currentTarget as HTMLDivElement).releasePointerCapture(ev.pointerId);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
          };

          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        }

        event.preventDefault();
        return;
      }

      lastClickRef.current = null;
      if (!event.shiftKey) {
        useInteractionStore.getState().clearSelection();
        syncStudioSelection();
      }

      marqueeStartRef.current = point;
      useInteractionStore.getState().setMarquee({ x: point.x, y: point.y, width: 0, height: 0 });
      (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);

      const onMove = (ev: PointerEvent) => {
        const start = marqueeStartRef.current;
        if (!start) {
          return;
        }
        const current = toArtboardPoint(ev.clientX, ev.clientY);
        useInteractionStore.getState().setMarquee(normalizeRect(start.x, start.y, current.x, current.y));
      };

      const onUp = (ev: PointerEvent) => {
        const start = marqueeStartRef.current;
        marqueeStartRef.current = null;
        const marquee = useInteractionStore.getState().marqueeRect;
        useInteractionStore.getState().setMarquee(null);
        (event.currentTarget as HTMLDivElement).releasePointerCapture(ev.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);

        if (start && marquee && (marquee.width > 4 || marquee.height > 4)) {
          const hits = hitTestInRect(nodes, marquee);
          const ids = hits.map((n) => n.controlId);
          if (ids.length > 0) {
            if (ev.shiftKey) {
              const merged = new Set([
                ...useInteractionStore.getState().selectedControlIds,
                ...ids,
              ]);
              useInteractionStore.getState().selectMany([...merged]);
            } else {
              useInteractionStore.getState().selectMany(ids);
            }
            syncStudioSelection();
          }
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      event.preventDefault();
    },
    [
      applyDragPosition,
      commitReparent,
      nodes,
      toArtboardPoint,
      updateReparentDropTarget,
    ],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const state = useInteractionStore.getState();
      if (state.draggingControlId || state.marqueeRect) {
        return;
      }
      const point = toArtboardPoint(event.clientX, event.clientY);
      const hit = hitTestAtPoint(nodes, point.x, point.y, {
        containerEditId: state.containerEditId,
      });
      useInteractionStore.getState().setHovered(hit?.controlId ?? null);
    },
    [nodes, toArtboardPoint],
  );

  const onPointerLeave = useCallback(() => {
    useInteractionStore.getState().setHovered(null);
  }, []);

  return { onPointerDown, onPointerMove, onPointerLeave, onContextMenu };
}
