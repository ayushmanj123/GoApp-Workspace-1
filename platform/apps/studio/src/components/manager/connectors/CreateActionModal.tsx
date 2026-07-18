import { useState } from "react";
import {
  connectorsApi,
  type HttpMethod,
} from "../../../api/connectors-api";
import shellStyles from "../../preview/RuntimePreviewModal.module.css";
import modalStyles from "../../layout/InsertComponentModal.module.css";

const ACTION_NAMES = ["list", "get", "create", "update", "delete"] as const;
const SQL_ACTION_NAMES = ["list"] as const;
const METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

interface CreateActionModalProps {
  open: boolean;
  connectorId: string;
  mode?: "rest" | "sql";
  onClose: () => void;
  onCreated: () => void;
}

export function CreateActionModal({
  open,
  connectorId,
  mode = "rest",
  onClose,
  onCreated,
}: CreateActionModalProps) {
  const isSql = mode === "sql";
  const [actionName, setActionName] = useState<string>("list");
  const [httpMethod, setHttpMethod] = useState<HttpMethod>("GET");
  const [endpoint, setEndpoint] = useState(isSql ? "SELECT * FROM public.orders" : "/items");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endpoint.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await connectorsApi.createAction(connectorId, {
        action_name: actionName,
        http_method: isSql ? "GET" : httpMethod,
        endpoint: endpoint.trim(),
      });
      setActionName("list");
      setHttpMethod("GET");
      setEndpoint(isSql ? "SELECT * FROM public.orders" : "/items");
      onClose();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create action");
    } finally {
      setSaving(false);
    }
  };

  const names = isSql ? SQL_ACTION_NAMES : ACTION_NAMES;

  return (
    <div className={shellStyles.overlay} onMouseDown={onClose}>
      <div
        className={`${shellStyles.dialog} ${modalStyles.dialog}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isSql ? "Create Named SQL Query" : "Create Connector Action"}
      >
        <header className={shellStyles.header}>
          <div className={shellStyles.title}>{isSql ? "New Named Query" : "New Action"}</div>
        </header>
        <form className={modalStyles.body} onSubmit={(e) => void handleSubmit(e)}>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            Action name
            <select
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
              value={actionName}
              onChange={(e) => setActionName(e.target.value)}
              data-testid="action-name-select"
            >
              {names.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {!isSql ? (
            <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
              HTTP method
              <select
                style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                value={httpMethod}
                onChange={(e) => setHttpMethod(e.target.value as HttpMethod)}
                data-testid="action-method-select"
              >
                {METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            {isSql ? "SQL query (SELECT only)" : "Endpoint"}
            {isSql ? (
              <textarea
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 4,
                  padding: "6px 8px",
                  minHeight: 96,
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 12,
                }}
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="SELECT id, name FROM public.orders WHERE active = true"
                required
                data-testid="action-endpoint-input"
              />
            ) : (
              <input
                style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="/items or /items/{id}"
                required
                data-testid="action-endpoint-input"
              />
            )}
          </label>
          {error ? (
            <p className={modalStyles.empty} style={{ color: "var(--color-danger)" }}>
              {error}
            </p>
          ) : null}
          <div className={modalStyles.footer}>
            <button
              type="button"
              className={modalStyles.cancelBtn}
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={modalStyles.itemBtn}
              style={{ width: "auto", marginLeft: 8 }}
              disabled={saving || !endpoint.trim()}
              data-testid="action-create-submit"
            >
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
