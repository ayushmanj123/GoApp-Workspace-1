import { useEffect, useState } from "react";
import { useStudioStore, type ConsoleTab } from "../../store/studioStore";
import { checkFormulaApiHealth } from "../formula/validate-formula";
import styles from "./ConsoleStrip.module.css";

const CONSOLE_TABS: { id: ConsoleTab; label: string }[] = [
  { id: "logs", label: "Logs" },
  { id: "console", label: "Console" },
  { id: "network", label: "Network" },
  { id: "ai", label: "AI Assistant" },
];

export function ConsoleStrip() {
  const zoom = useStudioStore((s) => s.zoom);
  const dirty = useStudioStore((s) => s.dirty);
  const saveMessage = useStudioStore((s) => s.saveMessage);
  const formulaCursor = useStudioStore((s) => s.formulaCursor);
  const consoleTab = useStudioStore((s) => s.consoleTab);
  const setConsoleTab = useStudioStore((s) => s.setConsoleTab);
  const [formulaApiHealthy, setFormulaApiHealthy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const healthy = await checkFormulaApiHealth();
      if (!cancelled) setFormulaApiHealthy(healthy);
    };
    void check();
    const id = window.setInterval(() => void check(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const statusText = saveMessage ?? (dirty ? "Unsaved changes" : "Logic & Output console active");

  return (
    <footer className={styles.strip}>
      <div className={styles.left}>
        <span
          className={styles.indicator}
          data-status={saveMessage === "Save failed" || !formulaApiHealthy ? "error" : "ok"}
        />
        <span className={styles.statusText}>{statusText}</span>
        {CONSOLE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={[styles.tab, consoleTab === tab.id ? styles.tabActive : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setConsoleTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={styles.right}>
        <span>
          Ln {formulaCursor.line}, Col {formulaCursor.column}
        </span>
        <span className={styles.divider}>·</span>
        <span>UTF-8</span>
        <span className={styles.divider}>·</span>
        <span>Zoom {zoom}%</span>
        <span className={styles.divider}>·</span>
        <span>GoApps v1.0.4</span>
      </div>
    </footer>
  );
}
