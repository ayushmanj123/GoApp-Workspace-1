import { useEffect, useState } from "react";
import { applicationsApi, type Application } from "../../../api/applications-api";
import { entitiesApi } from "../../../api/entities-api";
import shellStyles from "../../preview/RuntimePreviewModal.module.css";
import modalStyles from "../../layout/InsertComponentModal.module.css";

interface CreateTableModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTableModal({ open, onClose, onCreated }: CreateTableModalProps) {
  const [apps, setApps] = useState<Application[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pluralDisplayName, setPluralDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void applicationsApi.list().then((data) => {
      setApps(data.items);
      if (data.items.length > 0) {
        setApplicationId(data.items[0].id);
      }
    });
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicationId || !name.trim() || !displayName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await entitiesApi.create(applicationId, {
        name: name.trim(),
        display_name: displayName.trim(),
        plural_display_name: pluralDisplayName.trim() || undefined,
        description: description.trim() || undefined,
        create_primary_name: true,
      });
      setName("");
      setDisplayName("");
      setPluralDisplayName("");
      setDescription("");
      onClose();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create table");
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
        aria-label="Create Table"
      >
        <header className={shellStyles.header}>
          <div className={shellStyles.title}>New Table</div>
        </header>
        <form className={modalStyles.body} onSubmit={(e) => void handleSubmit(e)}>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            Application
            <select
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              required
            >
              {apps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
          </label>
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
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (!pluralDisplayName) setPluralDisplayName(`${e.target.value}s`);
              }}
              required
            />
          </label>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            Plural Display Name
            <input
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px" }}
              value={pluralDisplayName}
              onChange={(e) => setPluralDisplayName(e.target.value)}
            />
          </label>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            Description
            <textarea
              style={{ display: "block", width: "100%", marginTop: 4, padding: "6px 8px", minHeight: 60 }}
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
            <button type="button" className={modalStyles.cancelBtn} onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className={modalStyles.itemBtn}
              style={{ width: "auto", marginLeft: 8 }}
              disabled={saving || !applicationId || !name.trim() || !displayName.trim()}
            >
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
