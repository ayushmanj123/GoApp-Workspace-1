import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { applicationsApi, type Application } from "../../../api/applications-api";
import { Button } from "../../ui";
import { CreateExcelAppWizard } from "./CreateExcelAppWizard";
import styles from "../apps/AppsDashboard.module.css";

export function ExcelAppsPage() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await applicationsApi.list(200, 0);
      const excelApps = (page.items ?? []).filter((a) => {
        const desc = a.description ?? "";
        return desc.startsWith("excel_app:") && desc !== "excel_app:bootstrap";
      });
      setApps(excelApps);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Excel Apps");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Excel Apps</h1>
          <p className={styles.subtitle}>
            Build management apps from Google Sheets in Google Drive — live CRUD on your spreadsheet data.
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={() => setWizardOpen(true)}>
          + New Excel App
        </Button>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? (
        <p>Loading…</p>
      ) : apps.length === 0 ? (
        <div className={styles.empty}>
          <p>No Excel Apps yet. Create one from a Google Sheets spreadsheet.</p>
          <Button variant="secondary" size="sm" onClick={() => setWizardOpen(true)}>
            Create Excel App
          </Button>
        </div>
      ) : (
        <div className={styles.grid}>
          {apps.map((app) => (
            <button
              key={app.id}
              type="button"
              onClick={() => navigate(`/studio/apps/${app.id}`)}
              style={{
                textAlign: "left",
                padding: "var(--space-4)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                background: "var(--color-surface)",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{app.name}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                Google Sheets · {app.status}
              </div>
            </button>
          ))}
        </div>
      )}
      <CreateExcelAppWizard open={wizardOpen} onClose={() => { setWizardOpen(false); void load(); }} />
    </div>
  );
}
