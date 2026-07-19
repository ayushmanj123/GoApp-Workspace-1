import { useCallback, useEffect, useState } from "react";
import { connectorsApi, type ConnectorRecord } from "../../../api/connectors-api";
import {
  environmentsApi,
  type EnvironmentRecord,
  type EnvironmentSecretOverride,
} from "../../../api/environments-api";
import shellStyles from "../../preview/RuntimePreviewModal.module.css";
import modalStyles from "../../layout/InsertComponentModal.module.css";

interface EnvSecretsModalProps {
  open: boolean;
  applicationId: string;
  environment: EnvironmentRecord | null;
  onClose: () => void;
}

export function EnvSecretsModal({
  open,
  applicationId,
  environment,
  onClose,
}: EnvSecretsModalProps) {
  const [connectors, setConnectors] = useState<ConnectorRecord[]>([]);
  const [overrides, setOverrides] = useState<EnvironmentSecretOverride[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!applicationId || !environment) return;
    setLoading(true);
    setError(null);
    try {
      const [connPage, overridePage] = await Promise.all([
        connectorsApi.list(applicationId),
        environmentsApi.listSecretOverrides(applicationId, environment.id),
      ]);
      setConnectors(connPage.items);
      setOverrides(overridePage.items);
      setDrafts({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load secrets");
    } finally {
      setLoading(false);
    }
  }, [applicationId, environment]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open || !environment) return null;

  const handleSave = async (connectorId: string) => {
    const value = (drafts[connectorId] ?? "").trim();
    if (!value) return;
    setSavingId(connectorId);
    setError(null);
    try {
      await environmentsApi.upsertSecretOverride(applicationId, environment.id, {
        connector_id: connectorId,
        value,
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[connectorId];
        return next;
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save override");
    } finally {
      setSavingId(null);
    }
  };

  const handleClear = async (connectorId: string) => {
    setSavingId(connectorId);
    setError(null);
    try {
      await environmentsApi.deleteSecretOverride(
        applicationId,
        environment.id,
        connectorId,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear override");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className={shellStyles.overlay} onMouseDown={onClose}>
      <div
        className={`${shellStyles.dialog} ${modalStyles.dialog}`}
        style={{ maxWidth: 560 }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Environment secrets"
      >
        <header className={shellStyles.header}>
          <div className={shellStyles.title}>
            Secrets — {environment.name}
          </div>
        </header>
        <div className={modalStyles.body}>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 12 }}>
            Override connector credentials for this environment. Leave blank to
            keep using the app-default secret. Values are write-only.
          </p>
          {loading ? (
            <p className={modalStyles.empty}>Loading…</p>
          ) : overrides.length === 0 ? (
            <p className={modalStyles.empty}>
              No connectors with secrets on this application.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {overrides.map((row) => {
                const c = connectors.find((x) => x.id === row.connector_id);
                if (!c) return null;
                const has = row.has_override;
                return (
                  <div
                    key={c.id}
                    style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: 6,
                      padding: 10,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      {c.name}{" "}
                      <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}>
                        ({c.connector_type})
                      </span>
                    </div>
                    <div style={{ fontSize: 12, marginBottom: 6 }}>
                      {has ? "Override set" : "Using app-default secret"}
                    </div>
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder={has ? "Enter new override…" : "Set environment secret…"}
                      style={{ display: "block", width: "100%", padding: "6px 8px", marginBottom: 8 }}
                      value={drafts[c.id] ?? ""}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className={modalStyles.itemBtn}
                        style={{ width: "auto" }}
                        disabled={
                          savingId === c.id || !(drafts[c.id] ?? "").trim()
                        }
                        onClick={() => void handleSave(c.id)}
                      >
                        {savingId === c.id ? "Saving…" : "Save override"}
                      </button>
                      {has ? (
                        <button
                          type="button"
                          className={modalStyles.cancelBtn}
                          disabled={savingId === c.id}
                          onClick={() => void handleClear(c.id)}
                        >
                          Clear override
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {error ? (
            <p className={modalStyles.empty} style={{ color: "var(--color-danger)" }}>
              {error}
            </p>
          ) : null}
          <div className={modalStyles.footer}>
            <button type="button" className={modalStyles.cancelBtn} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
