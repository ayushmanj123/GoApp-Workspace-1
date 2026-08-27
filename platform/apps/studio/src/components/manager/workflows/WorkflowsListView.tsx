import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { applicationsApi, type Application } from "../../../api/applications-api";
import { workflowsApi, type WorkflowRecord } from "../../../api/workflows-api";
import { Button, SearchInput } from "../../ui";
import { CreateWorkflowModal } from "./CreateWorkflowModal";
import styles from "../connectors/connectors-manager.module.css";

const APP_STORAGE_KEY = "goapps.workflows.selectedAppId";

export function WorkflowsListView() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState(
    () => sessionStorage.getItem(APP_STORAGE_KEY) ?? "",
  );
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    setLoadingApps(true);
    void applicationsApi
      .list()
      .then((data) => {
        setApps(data.items);
        setSelectedAppId((prev) => {
          if (prev && data.items.some((a) => a.id === prev)) return prev;
          return data.items[0]?.id ?? "";
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load applications");
      })
      .finally(() => setLoadingApps(false));
  }, []);

  useEffect(() => {
    if (selectedAppId) {
      sessionStorage.setItem(APP_STORAGE_KEY, selectedAppId);
    }
  }, [selectedAppId]);

  const loadWorkflows = useCallback(async () => {
    if (!selectedAppId) {
      setWorkflows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await workflowsApi.list(selectedAppId);
      setWorkflows(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }, [selectedAppId]);

  useEffect(() => {
    void loadWorkflows();
  }, [loadWorkflows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workflows;
    return workflows.filter((w) => w.name.toLowerCase().includes(q));
  }, [workflows, search]);

  const handleDelete = async (wf: WorkflowRecord) => {
    const confirmed = window.confirm(`Delete workflow "${wf.name}"?`);
    if (!confirmed) return;
    setRemoving(wf.id);
    try {
      await workflowsApi.remove(wf.id);
      await loadWorkflows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete workflow");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Workflows</h1>
          <p className={styles.subtitle}>
            Manual, schedule, or webhook flows that call REST connector actions in order.
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={() => setCreateOpen(true)}
          disabled={!selectedAppId}
          data-testid="new-workflow-btn"
        >
          + New Workflow
        </Button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.appSelectWrap}>
          <select
            className={styles.appSelect}
            value={selectedAppId}
            onChange={(e) => setSelectedAppId(e.target.value)}
            disabled={loadingApps || apps.length === 0}
            data-testid="workflows-app-select"
            aria-label="Application"
          >
            {apps.length === 0 ? (
              <option value="">No applications</option>
            ) : (
              apps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))
            )}
          </select>
        </div>
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search workflows"
        />      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
      {loading || loadingApps ? (
        <div className={styles.loading}>Loading workflows…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          No workflows yet. Create one that calls a REST connector action.
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Trigger</th>
              <th>Steps</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((wf) => (
              <tr
                key={wf.id}
                data-testid={`workflow-row-${wf.name}`}
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/studio/workflows/${wf.id}`)}
              >
                <td className={styles.mono}>{wf.name}</td>
                <td>{wf.trigger_type ?? wf.definition?.trigger?.type ?? "manual"}</td>
                <td>{wf.definition?.steps?.length ?? 0}</td>
                <td>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(wf);
                    }}
                    disabled={removing === wf.id}
                  >
                    {removing === wf.id ? "…" : "Delete"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedAppId ? (
        <CreateWorkflowModal
          open={createOpen}
          applicationId={selectedAppId}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            void loadWorkflows();
            navigate(`/studio/workflows/${id}`);
          }}
        />
      ) : null}
    </>
  );
}
