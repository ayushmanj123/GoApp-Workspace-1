import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  packagesApi,
  type PackageComponentRecord,
  type PackageRecord,
} from "../../../api/packages-api";
import { Badge, Button, TabBar } from "../../ui";
import { PackageComponentsPanel } from "./PackageComponentsPanel";
import styles from "./packages-manager.module.css";

type DetailTab = "overview" | "components";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "components", label: "Components" },
];

export function PackageDetailView() {
  const { packageId } = useParams<{ packageId: string }>();
  const [pkg, setPkg] = useState<PackageRecord | null>(null);
  const [components, setComponents] = useState<PackageComponentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("");

  const load = useCallback(async () => {
    if (!packageId) return;
    setLoading(true);
    setError(null);
    try {
      const [pkgData, comps] = await Promise.all([
        packagesApi.get(packageId),
        packagesApi.listComponents(packageId),
      ]);
      setPkg(pkgData);
      setComponents(comps.items);
      setDisplayName(pkgData.display_name);
      setDescription(pkgData.description);
      setVersion(pkgData.version);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load package");
      setPkg(null);
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  useEffect(() => {
    void load();
  }, [load]);

  const readOnly = pkg?.is_master || pkg?.managed;

  const handleSave = async () => {
    if (!pkg || readOnly) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await packagesApi.update(pkg.id, {
        display_name: displayName.trim(),
        description: description.trim(),
        version: version.trim(),
      });
      setPkg(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save package");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  if (!pkg) {
    return (
      <div className={styles.error}>
        <p>{error ?? "Package not found."}</p>
        <Link to="/studio/packages" className={styles.backLink}>
          Back to packages
        </Link>
      </div>
    );
  }

  const badge = pkg.is_master
    ? "System / Read only"
    : pkg.managed
      ? "Managed"
      : "Unmanaged";

  return (
    <>
      <Link to="/studio/packages" className={styles.backLink}>
        ← Back to packages
      </Link>

      <div className={styles.detailHeader}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <h1 className={styles.detailTitle}>{pkg.display_name || pkg.name}</h1>
            <Badge variant={pkg.is_master ? "premium" : "default"}>{badge}</Badge>
          </div>
          <div className={styles.detailMeta}>
            Version {pkg.version} · {pkg.component_count} Components
          </div>
        </div>
      </div>

      <div className={styles.tabs}>
        <TabBar
          tabs={TABS}
          activeTab={tab}
          onTabChange={(id) => setTab(id as DetailTab)}
        />
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      {tab === "overview" ? (
        <div className={styles.overviewCard}>
          {pkg.is_master ? (
            <p className={styles.fieldValue}>
              The Master Solution is the source of truth for this environment. It
              automatically includes every App and Table. It cannot be edited or
              deleted.
            </p>
          ) : null}

          <label className={styles.field}>
            Display Name
            {readOnly ? (
              <span className={styles.fieldValue}>{pkg.display_name}</span>
            ) : (
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            )}
          </label>

          <label className={styles.field}>
            Name
            <span className={styles.fieldValue}>{pkg.name}</span>
          </label>

          <label className={styles.field}>
            Description
            {readOnly ? (
              <span className={styles.fieldValue}>{pkg.description || "—"}</span>
            ) : (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            )}
          </label>

          <label className={styles.field}>
            Version
            {readOnly ? (
              <span className={styles.fieldValue}>{pkg.version}</span>
            ) : (
              <input value={version} onChange={(e) => setVersion(e.target.value)} />
            )}
          </label>

          {!readOnly ? (
            <div className={styles.actions}>
              <Button
                variant="primary"
                size="sm"
                disabled={saving || !displayName.trim()}
                onClick={() => void handleSave()}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <PackageComponentsPanel
          pkg={pkg}
          components={components}
          onChanged={() => void load()}
        />
      )}
    </>
  );
}
