import { useEffect, useState } from "react";
import { useStudioStore } from "../../store/studioStore";
import styles from "./StatusBar.module.css";
import { checkFormulaApiHealth } from "../formula/validate-formula";

export function StatusBar() {
  const zoom = useStudioStore((s) => s.zoom);
  const screenName = useStudioStore((s) => s.screenName);
  const selectedControlId = useStudioStore((s) => s.selectedControlId);
  const dirty = useStudioStore((s) => s.dirty);
  const saveMessage = useStudioStore((s) => s.saveMessage);
  const [formulaApiHealthy, setFormulaApiHealthy] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkHealth = async () => {
      const healthy = await checkFormulaApiHealth();
      if (!cancelled) {
        setFormulaApiHealthy(healthy);
      }
    };

    void checkHealth();
    const intervalId = window.setInterval(() => {
      void checkHealth();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const statusText = saveMessage ?? (dirty ? "Unsaved changes" : "Ready");

  return (
    <footer className={styles.statusbar}>
      {/* Left section */}
      <div className={styles.section}>
        <span
          className={styles.indicator}
          data-status={saveMessage === "Save failed" ? "error" : "ok"}
          title="Metadata service connected"
        />
        <span className={styles.text}>{statusText}</span>
      </div>

      {!formulaApiHealthy && (
        <>
          <div className={styles.divider} />
          <div className={styles.section}>
            <span className={styles.warningText}>Formula engine unavailable</span>
          </div>
        </>
      )}

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
        <span className={styles.text}>Design mode — use Preview to test formulas</span>
      </div>

      <div className={styles.divider} />

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
