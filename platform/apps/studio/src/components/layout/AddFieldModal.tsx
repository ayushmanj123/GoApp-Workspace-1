import { useState } from "react";
import { useApplicationStore } from "../../store/applicationStore";
import type { EntityFieldType } from "../../api/entities-api";
import shellStyles from "../preview/RuntimePreviewModal.module.css";
import styles from "./InsertComponentModal.module.css";

const FIELD_TYPES: EntityFieldType[] = ["text", "number", "boolean", "date"];

interface AddFieldModalProps {
  open: boolean;
  entityId: string | null;
  entityName: string;
  onClose: () => void;
}

export function AddFieldModal({ open, entityId, entityName, onClose }: AddFieldModalProps) {
  const addEntityField = useApplicationStore((s) => s.addEntityField);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fieldType, setFieldType] = useState<EntityFieldType>("text");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !entityId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !displayName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await addEntityField(entityId, name.trim(), displayName.trim(), fieldType);
      setName("");
      setDisplayName("");
      setFieldType("text");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add field");
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
        aria-label={`Add Field to ${entityName}`}
        data-testid="add-field-modal"
      >
        <header className={shellStyles.header}>
          <div className={shellStyles.title}>Add Field — {entityName}</div>
        </header>
        <form className={styles.body} onSubmit={(e) => void handleSubmit(e)}>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            Name
            <input
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="add-field-name"
              autoFocus
            />
          </label>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            Display Name
            <input
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              data-testid="add-field-display-name"
            />
          </label>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            Field Type
            <select
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value as EntityFieldType)}
              data-testid="add-field-type"
            >
              {FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
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
              data-testid="add-field-submit"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
