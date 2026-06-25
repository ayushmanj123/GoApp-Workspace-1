import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useApplicationStore } from "../../store/applicationStore";
import { type ArtboardOffset } from "../CoordinateSystem";
import type { DesignerNode } from "../designer/DesignerNode";
import { findDesignerNode } from "../designer/DesignerNodeRegistry";
import { hitTestAtPoint, hitTestInRect } from "./HitTestService";
import { useInteractionStore } from "./interactionStore";
import { snapPosition } from "./snapGuides";
import { syncStudioSelection } from "./syncStudioSelection";

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
} {
  const updateControl = useApplicationStore((s) => s.updateControl);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastClickRef = useRef<{ controlId: string; time: number } | null>(null);

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
    (node: DesignerNode, absoluteX: number, absoluteY: number) => {
      const snapped = snapPosition(
        nodes,
        node.controlId,
        absoluteX,
        absoluteY,
        node.absoluteBounds.width,
        node.absoluteBounds.height,
      );
      useInteractionStore.getState().setAlignmentGuides(snapped.guides);

      const parent = node.parentId ? findDesignerNode(nodes, node.parentId) : null;
      const localX = parent ? snapped.x - parent.absoluteBounds.x : snapped.x;
      const localY = parent ? snapped.y - parent.absoluteBounds.y : snapped.y;

      updateControl(node.controlId, {
        x: Math.round(localX),
        y: Math.round(localY),
      });
    },
    [nodes, updateControl],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const state = useInteractionStore.getState();
        if (state.containerEditId) {
          state.exitContainerEdit();
        } else {
          state.clearSelection();
          syncStudioSelection();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target.dataset.resizeHandle === "true") {
        return;
      }

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
          lastClickRef.current = null;
          event.preventDefault();
          return;
        }
        lastClickRef.current = { controlId: hit.controlId, time: now };

        const additive = event.shiftKey;
        useInteractionStore.getState().select(hit.controlId, { additive });
        syncStudioSelection();

        if (hit.draggable) {
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
            const current = toArtboardPoint(ev.clientX, ev.clientY);
            const dx = current.x - dragState.dragStartPointer.x;
            const dy = current.y - dragState.dragStartPointer.y;
            const node = findDesignerNode(nodes, dragState.draggingControlId);
            if (!node) {
              return;
            }
            applyDragPosition(
              node,
              dragState.dragOrigin.x + dx,
              dragState.dragOrigin.y + dy,
            );
          };

          const onUp = (ev: PointerEvent) => {
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
    [applyDragPosition, nodes, toArtboardPoint],
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

  return { onPointerDown, onPointerMove, onPointerLeave };
}
