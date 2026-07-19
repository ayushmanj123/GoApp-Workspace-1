import { useCallback } from "react";
import { useApplicationStore } from "../../store/applicationStore";
import { toScreenBounds, type ArtboardOffset } from "../CoordinateSystem";
import { findDesignerNode } from "../designer/DesignerNodeRegistry";
import type { DesignerNode } from "../designer/DesignerNode";
import { clampRectToArtboard } from "../interaction/artboardClamp";
import {
  useInteractionStore,
  type ResizeHandle,
} from "../interaction/interactionStore";
import styles from "./overlay.module.css";

const HANDLES: { id: ResizeHandle; style: (b: DOMRect) => React.CSSProperties }[] = [
  {
    id: "top-left",
    style: (b) => ({ left: b.left - 4, top: b.top - 4, cursor: "nwse-resize" }),
  },
  {
    id: "top-center",
    style: (b) => ({
      left: b.left + b.width / 2 - 4,
      top: b.top - 4,
      cursor: "ns-resize",
    }),
  },
  {
    id: "top-right",
    style: (b) => ({ left: b.left + b.width - 4, top: b.top - 4, cursor: "nesw-resize" }),
  },
  {
    id: "middle-right",
    style: (b) => ({
      left: b.left + b.width - 4,
      top: b.top + b.height / 2 - 4,
      cursor: "ew-resize",
    }),
  },
  {
    id: "bottom-right",
    style: (b) => ({
      left: b.left + b.width - 4,
      top: b.top + b.height - 4,
      cursor: "nwse-resize",
    }),
  },
  {
    id: "bottom-center",
    style: (b) => ({
      left: b.left + b.width / 2 - 4,
      top: b.top + b.height - 4,
      cursor: "ns-resize",
    }),
  },
  {
    id: "bottom-left",
    style: (b) => ({
      left: b.left - 4,
      top: b.top + b.height - 4,
      cursor: "nesw-resize",
    }),
  },
  {
    id: "middle-left",
    style: (b) => ({
      left: b.left - 4,
      top: b.top + b.height / 2 - 4,
      cursor: "ew-resize",
    }),
  },
];

interface ResizeHandlesProps {
  nodes: DesignerNode[];
  offset: ArtboardOffset;
  zoom: number;
}

export function ResizeHandles({ nodes, offset, zoom }: ResizeHandlesProps) {
  const primaryControlId = useInteractionStore((s) => s.primaryControlId);
  const selectedCount = useInteractionStore((s) => s.selectedControlIds.length);
  const updateControl = useApplicationStore((s) => s.updateControl);
  const beginResize = useInteractionStore((s) => s.beginResize);
  const endResize = useInteractionStore((s) => s.endResize);
  const setAlignmentGuides = useInteractionStore((s) => s.setAlignmentGuides);

  const node = primaryControlId ? findDesignerNode(nodes, primaryControlId) : null;

  const onPointerDown = useCallback(
    (handle: ResizeHandle, event: React.PointerEvent) => {
      if (!node || !node.resizable) return;
      event.stopPropagation();
      event.preventDefault();
      beginResize(node.controlId, handle);

      const startX = event.clientX;
      const startY = event.clientY;
      const startBounds = { ...node.absoluteBounds };
      const scale = zoom / 100;

      const onMove = (ev: PointerEvent) => {
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        let { x, y, width, height } = startBounds;

        if (handle.includes("right")) width = Math.max(10, startBounds.width + dx);
        if (handle.includes("left")) {
          width = Math.max(10, startBounds.width - dx);
          x = startBounds.x + (startBounds.width - width);
        }
        if (handle.includes("bottom")) height = Math.max(10, startBounds.height + dy);
        if (handle.includes("top")) {
          height = Math.max(10, startBounds.height - dy);
          y = startBounds.y + (startBounds.height - height);
        }

        const clamped = clampRectToArtboard(x, y, width, height);
        x = clamped.x;
        y = clamped.y;
        width = clamped.width;
        height = clamped.height;

        const parentOffset = node.parentId
          ? findDesignerNode(nodes, node.parentId)?.absoluteBounds
          : null;
        const localX = parentOffset ? x - parentOffset.x : x;
        const localY = parentOffset ? y - parentOffset.y : y;

        updateControl(node.controlId, {
          x: Math.round(localX),
          y: Math.round(localY),
          width: Math.round(width),
          height: Math.round(height),
        });
      };

      const onUp = () => {
        endResize();
        setAlignmentGuides([]);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [node, nodes, zoom, beginResize, endResize, updateControl, setAlignmentGuides],
  );

  if (!node || !node.resizable || selectedCount !== 1) {
    return null;
  }

  const screen = toScreenBounds(node.absoluteBounds, offset, zoom);
  const rect = {
    left: screen.left,
    top: screen.top,
    width: screen.width,
    height: screen.height,
  } as DOMRect;

  return (
    <>
      {HANDLES.map(({ id, style }) => (
        <div
          key={id}
          className={styles.resizeHandle}
          data-resize-handle="true"
          style={style(rect)}
          onPointerDown={(e) => onPointerDown(id, e)}
        />
      ))}
    </>
  );
}
