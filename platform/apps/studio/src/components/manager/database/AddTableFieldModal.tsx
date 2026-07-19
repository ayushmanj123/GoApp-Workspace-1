import { useEffect, useState } from "react";
import {
  entitiesApi,
  type EntityFieldType,
} from "../../../api/entities-api";
import { useTenantTablesContext } from "./TenantTablesContext";
import shellStyles from "../../preview/RuntimePreviewModal.module.css";
import modalStyles from "../../layout/InsertComponentModal.module.css";

const FIELD_TYPES: EntityFieldType[] = ["text", "number", "boolean", "date", "lookup"];

interface AddTableFieldModalProps {
  open: boolean;
  entityId: string | null;
  entityName: string;
  onClose: () => void;
  onCreated: () => void;
  /** Preselects the field type — used by the "New relationship" entry point. */
  initialFieldType?: EntityFieldType;
  /** Overrides the modal header, e.g. "New Relationship". */
  title?: string;
}

export function AddTableFieldModal({
  open,
  entityId,
  entityName,
  onClose,
  onCreated,
  initialFieldType = "text",
  title = "Add Field",
}: AddTableFieldModalProps) {
  const { tables } = useTenantTablesContext();
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fieldType, setFieldType] = useState<EntityFieldType>(initialFieldType);
  const [relatedEntityId, setRelatedEntityId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFieldType(initialFieldType);
      setRelatedEntityId("");
    }
  }, [open, initialFieldType]);

  if (!open || !entityId) return null;

  const relatedTables = tables.filter((t) => t.id !== entityId);
  const isLookup = fieldType === "lookup";
  const canSubmit =
    name.trim().length > 0 && displayName.trim().length > 0 && (!isLookup || relatedEntityId.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await entitiesApi.createField(entityId, {
        name: name.trim(),
        display_name: displayName.trim(),
        field_type: fieldType,
        ...(isLookup ? { related_entity_id: relatedEntityId } : {}),
      });
      setName("");
      setDisplayName("");
      setFieldType(initialFieldType);
      setRelatedEntityId("");
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
        aria-label={`${title} — ${entityName}`}
      >
        <header className={shellStyles.header}>
          <div className={shellStyles.title}>{title} — {entityName}</div>
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
          {isLookup ? (
            <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
              Related Table
              <select
                style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                value={relatedEntityId}
                onChange={(e) => setRelatedEntityId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select a table…
                </option>
                {relatedTables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.display_name || t.name} ({t.application_name})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
              disabled={saving || !canSubmit}
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
