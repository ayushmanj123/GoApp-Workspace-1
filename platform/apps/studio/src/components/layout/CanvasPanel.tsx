import { useStudioStore } from "../../store/studioStore";
import styles from "./CanvasPanel.module.css";

const ZoomInIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const ZoomOutIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const FitIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const ZOOM_STEPS = [25, 50, 75, 100, 125, 150, 200];

export function CanvasPanel() {
  const zoom = useStudioStore((s) => s.zoom);
  const setZoom = useStudioStore((s) => s.setZoom);
  const screenName = useStudioStore((s) => s.screenName);

  const zoomIn = () => {
    const next = ZOOM_STEPS.find((z) => z > zoom) ?? zoom;
    setZoom(next);
  };

  const zoomOut = () => {
    const next = [...ZOOM_STEPS].reverse().find((z) => z < zoom) ?? zoom;
    setZoom(next);
  };

  const fitToWindow = () => setZoom(100);

  return (
    <div className={styles.panel}>
      {/* Canvas toolbar */}
      <div className={styles.toolbar}>
        <span className={styles.screenLabel}>{screenName}</span>

        <div className={styles.spacer} />

        <div className={styles.zoomControls}>
          <button className={styles.zoomBtn} onClick={zoomOut} title="Zoom out">
            <ZoomOutIcon />
          </button>
          <span className={styles.zoomValue}>{zoom}%</span>
          <button className={styles.zoomBtn} onClick={zoomIn} title="Zoom in">
            <ZoomInIcon />
          </button>
          <button
            className={styles.zoomBtn}
            onClick={fitToWindow}
            title="Fit to window"
          >
            <FitIcon />
          </button>
        </div>
      </div>

      {/* Canvas viewport */}
      <div className={styles.viewport}>
        <div
          className={styles.artboard}
          style={{
            width: `${1366 * (zoom / 100)}px`,
            height: `${768 * (zoom / 100)}px`,
          }}
        >
          {/* Placeholder grid overlay */}
          <div className={styles.emptyHint}>
            <div className={styles.emptyIcon}>⬜</div>
            <p className={styles.emptyTitle}>No controls yet</p>
            <p className={styles.emptySubtitle}>
              Use the Insert panel to add controls to this screen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
