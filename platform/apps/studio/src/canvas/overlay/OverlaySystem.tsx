import { SelectionOutline } from "./SelectionOutline";
import { ResizeHandles } from "./ResizeHandles";
import { MarqueeSelection } from "./MarqueeSelection";
import { AlignmentGuides } from "./AlignmentGuides";
import { useInteractionStore } from "../interaction/interactionStore";
import { syncStudioSelection } from "../interaction/syncStudioSelection";
import type { DesignerNode } from "../designer/DesignerNode";
import type { ArtboardOffset } from "../CoordinateSystem";
import styles from "./overlay.module.css";

interface OverlaySystemProps {
  nodes: DesignerNode[];
  offset: ArtboardOffset;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
}

export function OverlaySystem({
  nodes,
  offset,
  zoom,
  viewportWidth,
  viewportHeight,
}: OverlaySystemProps) {
  const containerEditId = useInteractionStore((s) => s.containerEditId);
  const exitContainerEdit = useInteractionStore((s) => s.exitContainerEdit);

  return (
    <div className={styles.overlayRoot}>
      {containerEditId && (
        <div className={styles.containerEditBanner} data-testid="container-edit-banner">
          Editing Container — Esc to exit{" "}
          <button
            type="button"
            onClick={() => {
              exitContainerEdit();
              syncStudioSelection();
            }}
          >
            Exit
          </button>
        </div>
      )}
      <AlignmentGuides
        offset={offset}
        zoom={zoom}
        viewportWidth={viewportWidth}
        viewportHeight={viewportHeight}
      />
      <MarqueeSelection offset={offset} zoom={zoom} />
      <SelectionOutline nodes={nodes} offset={offset} zoom={zoom} />
      <ResizeHandles nodes={nodes} offset={offset} zoom={zoom} />
    </div>
  );
}
