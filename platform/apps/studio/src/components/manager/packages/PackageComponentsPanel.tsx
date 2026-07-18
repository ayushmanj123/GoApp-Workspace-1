import { useMemo, useState } from "react";
import type {
  PackageComponentRecord,
  PackageComponentType,
  PackageRecord,
} from "../../../api/packages-api";
import { packagesApi } from "../../../api/packages-api";
import { Button, SearchInput } from "../../ui";
import { AddExistingModal } from "./AddExistingModal";
import styles from "./packages-manager.module.css";

interface PackageComponentsPanelProps {
  pkg: PackageRecord;
  components: PackageComponentRecord[];
  onChanged: () => void;
}

const GROUPS: { type: PackageComponentType; title: string }[] = [
  { type: "app", title: "Apps" },
  { type: "table", title: "Tables" },
];

export function PackageComponentsPanel({
  pkg,
  components,
  onChanged,
}: PackageComponentsPanelProps) {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const readOnly = pkg.is_master || pkg.managed;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return components;
    return components.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.display_name.toLowerCase().includes(q) ||
        c.component_type.toLowerCase().includes(q),
    );
  }, [components, search]);

  const handleRemove = async (component: PackageComponentRecord) => {
    const key = `${component.component_type}:${component.component_id}`;
    setRemoving(key);
    try {
      await packagesApi.removeComponent(
        pkg.id,
        component.component_type,
        component.component_id,
      );
      onChanged();
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Components</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className={styles.searchWrap} style={{ minWidth: 180 }}>
            <SearchInput
              fullWidth
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {!readOnly ? (
            <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
              + Add Existing
            </Button>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          {pkg.is_master
            ? "No apps or tables in this environment yet."
            : "No components yet. Add existing Apps or Tables."}
        </div>
      ) : (
        GROUPS.map((group) => {
          const items = filtered.filter((c) => c.component_type === group.type);
          if (items.length === 0) return null;
          return (
            <div key={group.type} className={styles.group}>
              <div className={styles.groupTitle}>{group.title}</div>
              {items.map((component) => {
                const key = `${component.component_type}:${component.component_id}`;
                return (
                  <div key={key} className={styles.componentRow}>
                    <div>
                      <div className={styles.componentName}>
                        {component.display_name || component.name}
                      </div>
                      <div className={styles.componentSub}>{component.name}</div>
                    </div>
                    {!readOnly ? (
                      <button
                        type="button"
                        className={styles.removeBtn}
                        disabled={removing === key}
                        onClick={() => void handleRemove(component)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })
      )}

      <AddExistingModal
        open={addOpen}
        packageId={pkg.id}
        existing={components}
        onClose={() => setAddOpen(false)}
        onAdded={onChanged}
      />
    </>
  );
}
