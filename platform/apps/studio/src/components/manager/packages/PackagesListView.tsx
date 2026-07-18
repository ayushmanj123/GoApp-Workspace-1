import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { packagesApi, type PackageRecord } from "../../../api/packages-api";
import { Badge, Button, SearchInput } from "../../ui";
import { CreatePackageModal } from "./CreatePackageModal";
import styles from "./packages-manager.module.css";

export function PackagesListView() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const loadPackages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await packagesApi.list();
      setPackages(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load packages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter(
      (pkg) =>
        pkg.name.toLowerCase().includes(q) ||
        pkg.display_name.toLowerCase().includes(q) ||
        pkg.description.toLowerCase().includes(q),
    );
  }, [packages, search]);

  return (
    <>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Packages</h1>
          <p className={styles.subtitle}>
            Logical containers that reference Apps and Tables from the Master
            Solution. Packages never duplicate components.
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={() => setCreateOpen(true)}>
          + New Package
        </Button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <SearchInput
            fullWidth
            placeholder="Search packages…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading packages…</div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>No packages yet. Create one to get started.</div>
      ) : (
        <div className={styles.list}>
          {filtered.map((pkg) => {
            const label = pkg.display_name || pkg.name;
            const badge = pkg.is_master
              ? "System / Read only"
              : pkg.managed
                ? "Managed"
                : "Unmanaged";
            return (
              <button
                key={pkg.id}
                type="button"
                className={[styles.card, pkg.is_master ? styles.cardMaster : ""]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => navigate(`/studio/packages/${pkg.id}`)}
              >
                <div className={styles.cardInfo}>
                  <div className={styles.cardTitleRow}>
                    <span className={styles.cardName}>{label}</span>
                    <Badge variant={pkg.is_master ? "premium" : "default"}>
                      {badge}
                    </Badge>
                  </div>
                  <div className={styles.cardMeta}>
                    Version {pkg.version} · {pkg.component_count} Components
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <CreatePackageModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          void loadPackages();
          navigate(`/studio/packages/${id}`);
        }}
      />
    </>
  );
}
