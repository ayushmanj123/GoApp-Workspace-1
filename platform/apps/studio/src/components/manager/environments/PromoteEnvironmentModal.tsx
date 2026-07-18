import { useEffect, useState } from "react";
import { publishApi, type ApplicationVersionSummary } from "../../../api/publish-api";
import { environmentsApi, type EnvironmentRecord } from "../../../api/environments-api";
import shellStyles from "../../preview/RuntimePreviewModal.module.css";
import modalStyles from "../../layout/InsertComponentModal.module.css";

interface PromoteEnvironmentModalProps {
  open: boolean;
  applicationId: string;
  environment: EnvironmentRecord | null;
  onClose: () => void;
  onPromoted: () => void;
}

export function PromoteEnvironmentModal({
  open,
  applicationId,
  environment,
  onClose,
  onPromoted,
}: PromoteEnvironmentModalProps) {
  const [versions, setVersions] = useState<ApplicationVersionSummary[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSelected("");
    setLoading(true);
    void publishApi
      .listVersions(applicationId)
      .then((data) => {
        const released = data.items.filter((v) => v.status === "released");
        setVersions(released);
        setSelected(released[0]?.id ?? "");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load versions");
      })
      .finally(() => setLoading(false));
  }, [open, applicationId]);

  if (!open || !environment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await environmentsApi.promote(applicationId, environment.id, {
        version_id: selected,
      });
      onClose();
      onPromoted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to promote environment");
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
        aria-label="Promote Environment"
      >
        <header className={shellStyles.header}>
          <div className={shellStyles.title}>Promote {environment.name}</div>
        </header>
        <form className={modalStyles.body} onSubmit={(e) => void handleSubmit(e)}>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 12 }}>
            Choose a released version to deploy to this environment.
          </p>
          {loading ? (
            <p className={modalStyles.empty}>Loading released versions…</p>
          ) : versions.length === 0 ? (
            <p className={modalStyles.empty}>
              No released versions yet. Publish this application first.
            </p>
          ) : (
            <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
              Version
              <select
                style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.version}
                  </option>
                ))}
              </select>
            </label>
          )}
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
              disabled={saving || !selected}
            >
              {saving ? "Promoting…" : "Promote"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
