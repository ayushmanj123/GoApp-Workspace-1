import { useState } from "react";
import {
  entitiesApi,
  type EntityFieldType,
} from "../../../api/entities-api";
import shellStyles from "../../preview/RuntimePreviewModal.module.css";
import modalStyles from "../../layout/InsertComponentModal.module.css";

const FIELD_TYPES: EntityFieldType[] = ["text", "number", "boolean", "date"];

interface AddTableFieldModalProps {
  open: boolean;
  entityId: string | null;
  entityName: string;
  onClose: () => void;
  onCreated: () => void;
}

export function AddTableFieldModal({
  open,
  entityId,
  entityName,
  onClose,
  onCreated,
}: AddTableFieldModalProps) {
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
      await entitiesApi.createField(entityId, {
        name: name.trim(),
        display_name: displayName.trim(),
        field_type: fieldType,
      });
      setName("");
      setDisplayName("");
      setFieldType("text");
      onClose();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add field");
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
        aria-label={`Add Field to ${entityName}`}
      >
        <header className={shellStyles.header}>
          <div className={shellStyles.title}>Add Field — {entityName}</div>
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
            Display Name
            <input
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </label>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            Field Type
            <select
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value as EntityFieldType)}
            >
              {FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
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
            <button type="button" className={modalStyles.cancelBtn} onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className={modalStyles.itemBtn}
              style={{ width: "auto", marginLeft: 8 }}
              disabled={saving || !name.trim() || !displayName.trim()}
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
