import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  connectorsApi,
  type ConnectorActionRecord,
  type ConnectorRecord,
} from "../../../api/connectors-api";
import {
  workflowsApi,
  workflowHookUrl,
  type WorkflowRecord,
  type WorkflowRunRecord,
  type WorkflowStep,
  type WorkflowTrigger,
  type WorkflowTriggerType,
} from "../../../api/workflows-api";
import { Button } from "../../ui";
import styles from "../connectors/connectors-manager.module.css";

function triggerFromWorkflow(wf: WorkflowRecord): WorkflowTrigger {
  const t = wf.definition?.trigger;
  if (t?.type === "schedule") {
    return {
      type: "schedule",
      cron: t.cron ?? wf.schedule_cron ?? "0 * * * *",
      timezone: t.timezone ?? wf.schedule_timezone ?? "UTC",
      enabled: t.enabled ?? wf.schedule_enabled ?? true,
    };
  }
  if (t?.type === "webhook") {
    return {
      type: "webhook",
      enabled: t.enabled ?? wf.webhook_enabled ?? true,
    };
  }
  return { type: "manual" };
}

export function WorkflowDetailView() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<WorkflowRecord | null>(null);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<WorkflowTrigger>({ type: "manual" });
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [connectors, setConnectors] = useState<ConnectorRecord[]>([]);
  const [actionsByConnector, setActionsByConnector] = useState<
    Record<string, ConnectorActionRecord[]>
  >({});
  const [runs, setRuns] = useState<WorkflowRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [plainSecret, setPlainSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hookUrl = useMemo(
    () => (workflowId ? workflowHookUrl(workflowId) : ""),
    [workflowId],
  );

  const load = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    setError(null);
    try {
      const wf = await workflowsApi.get(workflowId);
      setWorkflow(wf);
      setName(wf.name);
      setTrigger(triggerFromWorkflow(wf));
      setSteps(wf.definition?.steps ?? []);
      const connPage = await connectorsApi.list(wf.application_id);
      const rest = (connPage.items ?? []).filter((c) => c.connector_type === "rest");
      setConnectors(rest);
      const actionMap: Record<string, ConnectorActionRecord[]> = {};
      await Promise.all(
        rest.map(async (c) => {
          const page = await connectorsApi.listActions(c.id);
          actionMap[c.id] = page.items ?? [];
        }),
      );
      setActionsByConnector(actionMap);
      const runPage = await workflowsApi.listRuns(workflowId);
      setRuns(runPage.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflow");
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    void load();
  }, [load]);

  const buildTriggerPayload = (): WorkflowTrigger => {
    if (trigger.type === "schedule") {
      return {
        type: "schedule",
        cron: (trigger.cron ?? "0 * * * *").trim() || "0 * * * *",
        timezone: (trigger.timezone ?? "UTC").trim() || "UTC",
        enabled: trigger.enabled !== false,
      };
    }
    if (trigger.type === "webhook") {
      return {
        type: "webhook",
        enabled: trigger.enabled !== false,
      };
    }
    return { type: "manual" };
  };

  const handleSave = async () => {
    if (!workflowId || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await workflowsApi.update(workflowId, {
        name: name.trim(),
        definition: {
          trigger: buildTriggerPayload(),
          steps,
        },
      });
      setWorkflow(updated);
      setTrigger(triggerFromWorkflow(updated));
      setSteps(updated.definition?.steps ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save workflow");
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    if (!workflowId) return;
    setRunning(true);
    setError(null);
    try {
      await workflowsApi.run(workflowId);
      const runPage = await workflowsApi.listRuns(workflowId);
      setRuns(runPage.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run workflow");
    } finally {
      setRunning(false);
    }
  };

  const handleRotateSecret = async () => {
    if (!workflowId) return;
    setRotating(true);
    setError(null);
    try {
      const res = await workflowsApi.rotateWebhookSecret(workflowId);
      setPlainSecret(res.secret);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rotate webhook secret");
    } finally {
      setRotating(false);
    }
  };

  const updateStep = (index: number, patch: Partial<WorkflowStep>) => {
    setSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    );
  };

  const addStep = () => {
    const connectorId = connectors[0]?.id ?? "";
    const actions = actionsByConnector[connectorId] ?? [];
    setSteps((prev) => [
      ...prev,
      {
        id: `step-${prev.length + 1}`,
        type: "connector_action",
        connector_id: connectorId,
        action_name: actions[0]?.action_name ?? "list",
      },
    ]);
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const setTriggerType = (type: WorkflowTriggerType) => {
    if (type === "schedule") {
      setTrigger({
        type: "schedule",
        cron: trigger.cron ?? "0 */15 * * *",
        timezone: trigger.timezone ?? "UTC",
        enabled: true,
      });
      return;
    }
    if (type === "webhook") {
      setTrigger({ type: "webhook", enabled: true });
      return;
    }
    setTrigger({ type: "manual" });
  };

  if (loading) {
    return <div className={styles.loading}>Loading workflow…</div>;
  }

  if (!workflow) {
    return (
      <div className={styles.error}>
        {error ?? "Workflow not found."}
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" size="sm" onClick={() => navigate("/studio/workflows")}>
            Back to workflows
          </Button>
        </div>
      </div>
    );
  }

  const subtitle =
    trigger.type === "schedule"
      ? `Schedule · ${trigger.cron ?? ""} · Test run still available`
      : trigger.type === "webhook"
        ? "Webhook · Bearer secret · Test run still available"
        : "Manual trigger · connector_action steps · Test run executes synchronously";

  return (
    <>
      <button
        type="button"
        className={styles.backLink}
        onClick={() => navigate("/studio/workflows")}
      >
        ← Back to workflows
      </button>

      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{workflow.name}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => void handleRun()}
            disabled={running || steps.length === 0}
            data-testid="workflow-test-run-btn"
          >
            {running ? "Running…" : "Test run"}
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={() => void handleSave()}
            disabled={saving || !name.trim()}
            data-testid="workflow-save-btn"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.formGrid}>
        <div>
          <label className={styles.fieldLabel} htmlFor="workflow-name">
            Name
          </label>
          <input
            id="workflow-name"
            className={styles.fieldInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="workflow-detail-name"
          />
        </div>
        <div>
          <label className={styles.fieldLabel} htmlFor="workflow-trigger-type">
            Trigger
          </label>
          <select
            id="workflow-trigger-type"
            className={styles.fieldSelect}
            value={trigger.type}
            onChange={(e) => setTriggerType(e.target.value as WorkflowTriggerType)}
            data-testid="workflow-trigger-type"
          >
            <option value="manual">Manual</option>
            <option value="schedule">Schedule</option>
            <option value="webhook">Webhook</option>
          </select>
        </div>
      </div>

      {trigger.type === "schedule" ? (
        <div className={styles.formGrid} style={{ marginTop: 12 }}>
          <div>
            <label className={styles.fieldLabel} htmlFor="workflow-cron">
              Cron (5-field)
            </label>
            <input
              id="workflow-cron"
              className={styles.fieldInput}
              value={trigger.cron ?? ""}
              onChange={(e) => setTrigger((t) => ({ ...t, cron: e.target.value }))}
              placeholder="0 */15 * * *"
              data-testid="workflow-cron"
            />
          </div>
          <div>
            <label className={styles.fieldLabel} htmlFor="workflow-tz">
              Timezone
            </label>
            <input
              id="workflow-tz"
              className={styles.fieldInput}
              value={trigger.timezone ?? "UTC"}
              onChange={(e) => setTrigger((t) => ({ ...t, timezone: e.target.value }))}
              data-testid="workflow-timezone"
            />
          </div>
          <div>
            <label className={styles.fieldLabel} htmlFor="workflow-schedule-enabled">
              Enabled
            </label>
            <select
              id="workflow-schedule-enabled"
              className={styles.fieldSelect}
              value={trigger.enabled === false ? "false" : "true"}
              onChange={(e) =>
                setTrigger((t) => ({ ...t, enabled: e.target.value === "true" }))
              }
              data-testid="workflow-schedule-enabled"
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>
      ) : null}

      {trigger.type === "webhook" ? (
        <div style={{ marginTop: 16 }}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Webhook</h2>
          </div>
          <p className={styles.subtitle} style={{ marginBottom: 8 }}>
            POST with <code>Authorization: Bearer &lt;secret&gt;</code>. Per-user OAuth
            connectors will fail without a user (use app-scoped OAuth or header auth).
          </p>
          <div className={styles.formGrid}>
            <div>
              <label className={styles.fieldLabel} htmlFor="workflow-hook-url">
                Hook URL
              </label>
              <input
                id="workflow-hook-url"
                className={styles.fieldInput}
                readOnly
                value={hookUrl}
                data-testid="workflow-hook-url"
                onFocus={(e) => e.target.select()}
              />
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="workflow-webhook-enabled">
                Enabled
              </label>
              <select
                id="workflow-webhook-enabled"
                className={styles.fieldSelect}
                value={trigger.enabled === false ? "false" : "true"}
                onChange={(e) =>
                  setTrigger((t) => ({ ...t, enabled: e.target.value === "true" }))
                }
                data-testid="workflow-webhook-enabled"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleRotateSecret()}
              disabled={rotating}
              data-testid="workflow-rotate-secret"
            >
              {rotating
                ? "Generating…"
                : workflow.webhook_secret_id
                  ? "Rotate secret"
                  : "Generate secret"}
            </Button>
            {workflow.webhook_secret_id && !plainSecret ? (
              <span className={styles.subtitle}>Secret configured (••••)</span>
            ) : null}
          </div>
          {plainSecret ? (
            <div className={styles.error} style={{ marginTop: 12 }} data-testid="workflow-plain-secret">
              Copy this secret now — it will not be shown again:
              <code style={{ display: "block", marginTop: 6, wordBreak: "break-all" }}>
                {plainSecret}
              </code>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Steps</h2>
        <Button variant="primary" size="sm" onClick={addStep} data-testid="workflow-add-step">
          + Add Step
        </Button>
      </div>

      {steps.length === 0 ? (
        <div className={styles.empty}>Add at least one connector action step.</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Id</th>
              <th>Connector</th>
              <th>Action</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {steps.map((step, index) => {
              const actions = actionsByConnector[step.connector_id] ?? [];
              return (
                <tr key={`${step.id}-${index}`}>
                  <td>
                    <input
                      className={styles.fieldInput}
                      value={step.id}
                      onChange={(e) => updateStep(index, { id: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      className={styles.fieldSelect}
                      value={step.connector_id}
                      onChange={(e) => {
                        const id = e.target.value;
                        const nextActions = actionsByConnector[id] ?? [];
                        updateStep(index, {
                          connector_id: id,
                          action_name: nextActions[0]?.action_name ?? "list",
                        });
                      }}
                    >
                      {connectors.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className={styles.fieldSelect}
                      value={step.action_name}
                      onChange={(e) => updateStep(index, { action_name: e.target.value })}
                    >
                      {(actions.length ? actions : [{ action_name: step.action_name }]).map(
                        (a) => (
                          <option key={a.action_name} value={a.action_name}>
                            {a.action_name}
                          </option>
                        ),
                      )}
                    </select>
                  </td>
                  <td>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => removeStep(index)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Run history</h2>
      </div>
      {runs.length === 0 ? (
        <div className={styles.empty}>No runs yet. Click Test run.</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Status</th>
              <th>Source</th>
              <th>Started</th>
              <th>Finished</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} data-testid={`workflow-run-${run.id}`}>
                <td>{run.status}</td>
                <td>{run.trigger_source ?? "manual"}</td>
                <td className={styles.mono}>{run.started_on}</td>
                <td className={styles.mono}>{run.finished_on ?? "—"}</td>
                <td>{run.result?.error ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
