import { useEffect, useState } from "react";
import {
  ENTITY_FIELD_TYPES,
  entitiesApi,
  fieldOptions,
  type EntityFieldRecord,
  type EntityFieldType,
} from "../../../api/entities-api";
import { useTenantTablesContext } from "./TenantTablesContext";
import shellStyles from "../../preview/RuntimePreviewModal.module.css";
import modalStyles from "../../layout/InsertComponentModal.module.css";

interface EditFieldModalProps {
  open: boolean;
  field: EntityFieldRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditFieldModal({ open, field, onClose, onSaved }: EditFieldModalProps) {
  const { tables } = useTenantTablesContext();
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fieldType, setFieldType] = useState<EntityFieldType>("text");
  const [relatedEntityId, setRelatedEntityId] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [isUnique, setIsUnique] = useState(false);
  const [optionsText, setOptionsText] = useState("");
  const [deleteBehavior, setDeleteBehavior] = useState<"restrict" | "clear" | "cascade">("restrict");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (field) {
      setName(field.name);
      setDisplayName(field.display_name);
      setFieldType(field.field_type);
      setRelatedEntityId(field.related_entity_id ?? "");
      setIsRequired(Boolean(field.is_required));
      setIsUnique(Boolean(field.is_unique));
      setOptionsText(fieldOptions(field).join("\n"));
      setDeleteBehavior(field.delete_behavior ?? "restrict");
    }
  }, [field]);

  if (!open || !field) return null;

  const relatedTables = tables.filter((t) => t.id !== field.entity_id);
  const isLookup = fieldType === "lookup";
  const isChoice = fieldType === "choice" || fieldType === "choices";
  const canSubmit =
    name.trim().length > 0 &&
    displayName.trim().length > 0 &&
    (!isLookup || relatedEntityId.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const options = isChoice
        ? optionsText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
      await entitiesApi.updateField(field.id, {
        name: name.trim(),
        display_name: displayName.trim(),
        field_type: fieldType,
        is_required: isRequired,
        is_unique: isUnique,
        related_entity_id: isLookup ? relatedEntityId : "",
        delete_behavior: isLookup ? deleteBehavior : undefined,
        ...(options ? { options } : {}),
      });
      onClose();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update field");
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
        aria-label="Edit Field"
      >
        <header className={shellStyles.header}>
          <div className={shellStyles.title}>Edit Field</div>
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
              {ENTITY_FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, fontSize: 12 }}>
            <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
            Required
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, fontSize: 12 }}>
            <input type="checkbox" checked={isUnique} onChange={(e) => setIsUnique(e.target.checked)} />
            Unique
          </label>
          {isChoice ? (
            <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
              Options (one per line)
              <textarea
                style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", minHeight: 80 }}
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
              />
            </label>
          ) : null}
          {isLookup ? (
            <>
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
              <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
                Delete behavior
                <select
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
                  value={deleteBehavior}
                  onChange={(e) =>
                    setDeleteBehavior(e.target.value as "restrict" | "clear" | "cascade")
                  }
                >
                  <option value="restrict">Restrict</option>
                  <option value="clear">Clear</option>
                  <option value="cascade">Cascade</option>
                </select>
              </label>
            </>
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
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
