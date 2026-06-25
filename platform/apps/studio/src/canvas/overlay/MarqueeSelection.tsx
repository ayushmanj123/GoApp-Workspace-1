import { useInteractionStore } from "../interaction/interactionStore";
import { toScreenBounds, type ArtboardOffset } from "../CoordinateSystem";
import styles from "./overlay.module.css";

interface MarqueeSelectionProps {
  offset: ArtboardOffset;
  zoom: number;
}

export function MarqueeSelection({ offset, zoom }: MarqueeSelectionProps) {
  const marqueeRect = useInteractionStore((s) => s.marqueeRect);
  if (!marqueeRect) {
    return null;
  }

  const screen = toScreenBounds(marqueeRect, offset, zoom);
  return (
    <div
      className={styles.marquee}
      style={{
        left: screen.left,
        top: screen.top,
        width: screen.width,
        height: screen.height,
      }}
    />
  );
}
