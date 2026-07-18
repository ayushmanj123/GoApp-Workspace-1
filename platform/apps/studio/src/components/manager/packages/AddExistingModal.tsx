import { useEffect, useMemo, useState } from "react";
import { applicationsApi } from "../../../api/applications-api";
import { entitiesApi } from "../../../api/entities-api";
import {
  packagesApi,
  type PackageComponentRecord,
  type PackageComponentType,
} from "../../../api/packages-api";
import shellStyles from "../../preview/RuntimePreviewModal.module.css";
import modalStyles from "../../layout/InsertComponentModal.module.css";
import styles from "./packages-manager.module.css";

interface CatalogItem {
  id: string;
  name: string;
  displayName: string;
  type: PackageComponentType;
}

interface AddExistingModalProps {
  open: boolean;
  packageId: string;
  existing: PackageComponentRecord[];
  onClose: () => void;
  onAdded: () => void;
}

export function AddExistingModal({
  open,
  packageId,
  existing,
  onClose,
  onAdded,
}: AddExistingModalProps) {
  const [category, setCategory] = useState<PackageComponentType>("app");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingKeys = useMemo(() => {
    const set = new Set<string>();
    for (const item of existing) {
      set.add(`${item.component_type}:${item.component_id}`);
    }
    return set;
  }, [existing]);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        const apps = await applicationsApi.list();
        const appItems: CatalogItem[] = apps.items.map((app) => ({
          id: app.id,
          name: app.name,
          displayName: app.name,
          type: "app",
        }));
        const entityResults = await Promise.all(
          apps.items.map(async (app) => {
            const data = await entitiesApi.list(app.id);
            return data.items.map((entity) => ({
              id: entity.id,
              name: entity.name,
              displayName: entity.display_name || entity.name,
              type: "table" as const,
            }));
          }),
        );
        setCatalog([...appItems, ...entityResults.flat()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load catalog");
        setCatalog([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  const visible = catalog.filter((item) => item.type === category);

  const toggle = (item: CatalogItem) => {
    const key = `${item.type}:${item.id}`;
    if (existingKeys.has(key)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      for (const key of selected) {
        const colon = key.indexOf(":");
        const type = key.slice(0, colon) as PackageComponentType;
        const id = key.slice(colon + 1);
        await packagesApi.addComponent(packageId, {
          component_type: type,
          component_id: id,
        });
      }
      onClose();
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add components");
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
        aria-label="Add Existing Components"
      >
        <header className={shellStyles.header}>
          <div className={shellStyles.title}>Add Existing</div>
        </header>
        <form className={modalStyles.body} onSubmit={(e) => void handleSubmit(e)}>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 8 }}>
            Select Apps or Tables already in the Master Solution. References only — no
            copies.
          </p>
          <div className={styles.categoryTabs}>
            <button
              type="button"
              className={[
                styles.categoryTab,
                category === "app" ? styles.categoryTabActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setCategory("app")}
            >
              Apps
            </button>
            <button
              type="button"
              className={[
                styles.categoryTab,
                category === "table" ? styles.categoryTabActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setCategory("table")}
            >
              Tables
            </button>
          </div>

          {loading ? (
            <p className={modalStyles.empty}>Loading…</p>
          ) : (
            <div className={styles.catalogList}>
              {visible.length === 0 ? (
                <p className={modalStyles.empty}>No {category === "app" ? "apps" : "tables"} found</p>
              ) : (
                visible.map((item) => {
                  const key = `${item.type}:${item.id}`;
                  const already = existingKeys.has(key);
                  const isSelected = selected.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={[
                        styles.catalogItem,
                        isSelected ? styles.catalogItemSelected : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={already}
                      onClick={() => toggle(item)}
                    >
                      <input
                        type="checkbox"
                        checked={already || isSelected}
                        readOnly
                        disabled={already}
                      />
                      <span>
                        {item.displayName}
                        {already ? " (already added)" : ""}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
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
              disabled={saving || selected.size === 0}
            >
              {saving ? "Adding…" : `Add (${selected.size})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
