import { useState } from "react";
import {
  workflowsApi,
  type WorkflowDefinition,
  type WorkflowStep,
} from "../../../api/workflows-api";
import { connectorsApi, type ConnectorRecord } from "../../../api/connectors-api";
import shellStyles from "../../preview/RuntimePreviewModal.module.css";
import modalStyles from "../../layout/InsertComponentModal.module.css";
import { useEffect } from "react";

interface CreateWorkflowModalProps {
  open: boolean;
  applicationId: string;
  onClose: () => void;
  onCreated: (workflowId: string) => void;
}

export function CreateWorkflowModal({
  open,
  applicationId,
  onClose,
  onCreated,
}: CreateWorkflowModalProps) {
  const [name, setName] = useState("");
  const [connectors, setConnectors] = useState<ConnectorRecord[]>([]);
  const [connectorId, setConnectorId] = useState("");
  const [actionName, setActionName] = useState("list");
  const [actions, setActions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !applicationId) return;
    void connectorsApi.list(applicationId).then((page) => {
      const rest = (page.items ?? []).filter((c) => c.connector_type === "rest");
      setConnectors(rest);
      setConnectorId(rest[0]?.id ?? "");
    });
  }, [open, applicationId]);

  useEffect(() => {
    if (!connectorId) {
      setActions([]);
      return;
    }
    void connectorsApi.listActions(connectorId).then((page) => {
      const names = (page.items ?? []).map((a) => a.action_name);
      setActions(names);
      setActionName(names.includes("list") ? "list" : names[0] ?? "list");
    });
  }, [connectorId]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !connectorId) return;
    setSaving(true);
    setError(null);
    try {
      const step: WorkflowStep = {
        id: "step-1",
        type: "connector_action",
        connector_id: connectorId,
        action_name: actionName.trim() || "list",
      };
      const definition: WorkflowDefinition = {
        trigger: { type: "manual" },
        steps: [step],
      };
      const wf = await workflowsApi.create(applicationId, {
        name: name.trim(),
        definition,
      });
      setName("");
      onClose();
      onCreated(wf.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workflow");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={shellStyles.overlay} onMouseDown={onClose}>
      <div
        className={`${shellStyles.dialog} ${modalStyles.dialog}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create Workflow"
      >
        <header className={shellStyles.header}>
          <h2 className={shellStyles.title}>New Workflow</h2>
        </header>
        <form onSubmit={(e) => void handleSubmit(e)} className={modalStyles.body}>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            Name
            <input
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              data-testid="workflow-create-name"
            />
          </label>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            Connector (REST)
            <select
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
              value={connectorId}
              onChange={(e) => setConnectorId(e.target.value)}
              required
              data-testid="workflow-create-connector"
            >
              {connectors.length === 0 ? (
                <option value="">No REST connectors</option>
              ) : (
                connectors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            Action
            <select
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
              value={actionName}
              onChange={(e) => setActionName(e.target.value)}
              data-testid="workflow-create-action"
            >
              {actions.length === 0 ? (
                <option value="list">list</option>
              ) : (
                actions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))
              )}
            </select>
          </label>
          <p style={{ fontSize: 11, color: "#666" }}>
            Starts with a manual trigger. Set schedule or webhook on the detail page after create.
          </p>
          {error ? (
            <p className={modalStyles.empty} style={{ color: "var(--color-danger)" }}>
              {error}
            </p>
          ) : null}
          <div className={modalStyles.footer}>
            <button type="button" className={modalStyles.cancelBtn} onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className={modalStyles.itemBtn}
              style={{ width: "auto", marginLeft: 8 }}
              disabled={saving || !name.trim() || !connectorId}
              data-testid="workflow-create-submit"
            >
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
