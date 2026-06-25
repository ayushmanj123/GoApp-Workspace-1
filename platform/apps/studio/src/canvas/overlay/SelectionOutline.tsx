import { useInteractionStore } from "../interaction/interactionStore";
import { toScreenBounds, type ArtboardOffset } from "../CoordinateSystem";
import { findDesignerNode } from "../designer/DesignerNodeRegistry";
import type { DesignerNode } from "../designer/DesignerNode";
import styles from "./overlay.module.css";

interface SelectionOutlineProps {
  nodes: DesignerNode[];
  offset: ArtboardOffset;
  zoom: number;
}

export function SelectionOutline({ nodes, offset, zoom }: SelectionOutlineProps) {
  const selectedControlIds = useInteractionStore((s) => s.selectedControlIds);
  const hoveredControlId = useInteractionStore((s) => s.hoveredControlId);

  return (
    <>
      {hoveredControlId &&
        !selectedControlIds.includes(hoveredControlId) &&
        (() => {
          const node = findDesignerNode(nodes, hoveredControlId);
          if (!node) return null;
          const bounds = toScreenBounds(node.absoluteBounds, offset, zoom);
          return (
            <div
              className={styles.hoverOutline}
              style={{
                left: bounds.left,
                top: bounds.top,
                width: bounds.width,
                height: bounds.height,
              }}
            />
          );
        })()}

      {selectedControlIds.map((id) => {
        const node = findDesignerNode(nodes, id);
        if (!node) return null;
        const bounds = toScreenBounds(node.absoluteBounds, offset, zoom);
        return (
          <div
            key={id}
            className={`${styles.selectionOutline} ${selectedControlIds.length > 1 ? styles.multiOutline : ""}`}
            style={{
              left: bounds.left,
              top: bounds.top,
              width: bounds.width,
              height: bounds.height,
            }}
          />
        );
      })}
    </>
  );
}
