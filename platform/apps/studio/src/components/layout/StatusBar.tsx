import { useStudioStore } from "../../store/studioStore";
import styles from "./StatusBar.module.css";

export function StatusBar() {
  const zoom = useStudioStore((s) => s.zoom);
  const screenName = useStudioStore((s) => s.screenName);
  const selectedControlId = useStudioStore((s) => s.selectedControlId);

  return (
    <footer className={styles.statusbar}>
      {/* Left section */}
      <div className={styles.section}>
        <span
          className={styles.indicator}
          data-status="ok"
          title="Metadata service connected"
        />
        <span className={styles.text}>Ready</span>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <span className={styles.text}>Screen:</span>
        <span className={styles.value}>{screenName}</span>
      </div>

      {selectedControlId && (
        <>
          <div className={styles.divider} />
          <div className={styles.section}>
            <span className={styles.text}>Selected:</span>
            <span className={styles.value}>{selectedControlId}</span>
          </div>
        </>
      )}

      {/* Right: zoom */}
      <div className={styles.spacer} />
      <div className={styles.section}>
        <span className={styles.text}>Zoom:</span>
        <span className={styles.value}>{zoom}%</span>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <span className={styles.text}>GoApps Studio v0.1.0</span>
      </div>
    </footer>
  );
}
