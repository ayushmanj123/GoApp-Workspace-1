import { useInteractionStore } from "../interaction/interactionStore";
import { type ArtboardOffset } from "../CoordinateSystem";
import styles from "./overlay.module.css";

interface AlignmentGuidesProps {
  offset: ArtboardOffset;
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
}

export function AlignmentGuides({
  offset,
  zoom,
  viewportWidth,
  viewportHeight,
}: AlignmentGuidesProps) {
  const guides = useInteractionStore((s) => s.alignmentGuides);
  const scale = zoom / 100;

  if (guides.length === 0) {
    return null;
  }

  return (
    <>
      {guides.map((guide, index) =>
        guide.orientation === "h" ? (
          <div
            key={`h-${index}`}
            className={styles.guideH}
            style={{ top: offset.stageY + guide.position * scale, width: viewportWidth }}
          />
        ) : (
          <div
            key={`v-${index}`}
            className={styles.guideV}
            style={{ left: offset.stageX + guide.position * scale, height: viewportHeight }}
          />
        ),
      )}
    </>
  );
}
