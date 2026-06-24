import { useState } from "react";
import { useApplicationStore } from "../../store/applicationStore";
import shellStyles from "../preview/RuntimePreviewModal.module.css";
import styles from "./InsertComponentModal.module.css";

interface CreateEntityModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateEntityModal({ open, onClose }: CreateEntityModalProps) {
  const createEntity = useApplicationStore((s) => s.createEntity);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !displayName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createEntity(name.trim(), displayName.trim());
      setName("");
      setDisplayName("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create entity");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={shellStyles.overlay} onMouseDown={onClose}>
      <div
        className={`${shellStyles.dialog} ${styles.dialog}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create Entity"
        data-testid="create-entity-modal"
      >
        <header className={shellStyles.header}>
          <div className={shellStyles.title}>Create Entity</div>
        </header>
        <form className={styles.body} onSubmit={(e) => void handleSubmit(e)}>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            Name
            <input
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="create-entity-name"
              autoFocus
            />
          </label>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            Display Name
            <input
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              data-testid="create-entity-display-name"
            />
          </label>
          {error && <p className={styles.empty} style={{ color: "var(--color-danger)" }}>{error}</p>}
          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className={styles.itemBtn}
              style={{ width: "auto", marginLeft: 8 }}
              disabled={saving || !name.trim() || !displayName.trim()}
              data-testid="create-entity-submit"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
