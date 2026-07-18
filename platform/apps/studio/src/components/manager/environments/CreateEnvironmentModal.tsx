import { useState } from "react";
import {
  environmentsApi,
  type EnvironmentType,
} from "../../../api/environments-api";
import shellStyles from "../../preview/RuntimePreviewModal.module.css";
import modalStyles from "../../layout/InsertComponentModal.module.css";

interface CreateEnvironmentModalProps {
  open: boolean;
  applicationId: string;
  onClose: () => void;
  onCreated: () => void;
}

const TYPE_OPTIONS: { value: EnvironmentType; label: string }[] = [
  { value: "development", label: "Development" },
  { value: "test", label: "Test" },
  { value: "production", label: "Production" },
];

export function CreateEnvironmentModal({
  open,
  applicationId,
  onClose,
  onCreated,
}: CreateEnvironmentModalProps) {
  const [name, setName] = useState("");
  const [environmentType, setEnvironmentType] =
    useState<EnvironmentType>("development");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await environmentsApi.create(applicationId, {
        name: name.trim(),
        environment_type: environmentType,
      });
      setName("");
      setEnvironmentType("development");
      onClose();
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create environment",
      );
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
        aria-label="Create Environment"
      >
        <header className={shellStyles.header}>
          <div className={shellStyles.title}>New Environment</div>
        </header>
        <form className={modalStyles.body} onSubmit={(e) => void handleSubmit(e)}>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            Name
            <input
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </label>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            Type
            <select
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
              value={environmentType}
              onChange={(e) => setEnvironmentType(e.target.value as EnvironmentType)}
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
              disabled={saving || !name.trim()}
            >
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
