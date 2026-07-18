import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApplicationStore } from "../../../store/applicationStore";
import { Button, SearchInput, SegmentedControl } from "../../ui";
import { AppCard, NewAppCard } from "./AppCard";
import { CreateAppModal } from "./CreateAppModal";
import styles from "./AppsDashboard.module.css";

type StatusFilter = "all" | "published" | "draft";

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "published", label: "Active" },
  { value: "draft", label: "Draft" },
];

export function AppsDashboard() {
  const navigate = useNavigate();
  const applications = useApplicationStore((s) => s.applications);
  const appsLoading = useApplicationStore((s) => s.appsLoading);
  const appsError = useApplicationStore((s) => s.appsError);
  const loadApplications = useApplicationStore((s) => s.loadApplications);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const filteredApps = useMemo(() => {
    const query = search.trim().toLowerCase();
    return applications.filter((app) => {
      if (statusFilter === "published" && app.status !== "published") return false;
      if (statusFilter === "draft" && app.status !== "draft") return false;
      if (!query) return true;
      return (
        app.name.toLowerCase().includes(query) ||
        app.description.toLowerCase().includes(query)
      );
    });
  }, [applications, search, statusFilter]);

  const handleCreated = useCallback(
    (appId: string) => {
      void loadApplications();
      navigate(`/studio/apps/${appId}`);
    },
    [loadApplications, navigate],
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Apps</h1>
          <p className={styles.subtitle}>
            Manage and monitor your application ecosystem across environments with
            real-time telemetry and deployment controls.
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={() => setCreateOpen(true)}>
          + New App
        </Button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <SearchInput
            fullWidth
            placeholder="Filter by app name or package..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <SegmentedControl
          options={FILTER_OPTIONS}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
        />
      </div>

      {appsLoading ? (
        <div className={styles.loading}>Loading applications…</div>
      ) : appsError ? (
        <div className={styles.error}>{appsError}</div>
      ) : (
        <div className={styles.grid}>
          {filteredApps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              onPublishComplete={() => void loadApplications()}
            />
          ))}
          <NewAppCard onClick={() => setCreateOpen(true)} />
          {filteredApps.length === 0 && applications.length > 0 ? (
            <div className={styles.empty}>No apps match your filters.</div>
          ) : null}
        </div>
      )}

      <CreateAppModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
