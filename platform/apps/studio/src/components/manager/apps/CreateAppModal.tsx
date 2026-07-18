import { useState } from "react";
import { applicationsApi } from "../../../api/applications-api";
import shellStyles from "../../preview/RuntimePreviewModal.module.css";
import modalStyles from "../../layout/InsertComponentModal.module.css";

interface CreateAppModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (appId: string) => void;
}

export function CreateAppModal({ open, onClose, onCreated }: CreateAppModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const app = await applicationsApi.create({
        name: name.trim(),
        description: description.trim(),
      });
      setName("");
      setDescription("");
      onClose();
      onCreated(app.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create application");
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
        aria-label="Create Application"
      >
        <header className={shellStyles.header}>
          <div className={shellStyles.title}>New Application</div>
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
            Description
            <textarea
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: "6px 8px",
                minHeight: 72,
                resize: "vertical",
              }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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
