import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenantTablesContext } from "./TenantTablesContext";
import { Button, SearchInput } from "../../ui";
import { CreateTableModal } from "./CreateTableModal";
import styles from "./database-manager.module.css";

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

export function TablesListView() {
  const navigate = useNavigate();
  const { tables, loading, error, loadTables } = useTenantTablesContext();
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.display_name.toLowerCase().includes(q) ||
        t.application_name.toLowerCase().includes(q),
    );
  }, [tables, search]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openProperty = (entityId: string, section?: "fields" | "relationships") => {
    const suffix = section ? `?section=${section}` : "";
    navigate(`/studio/database/tables/${entityId}${suffix}`);
  };

  return (
    <>
      <div className={styles.toolbar}>
        <span className={styles.tabLabel}>Tables</span>
        <div className={styles.searchWrap}>
          <SearchInput
            fullWidth
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
          + New
        </Button>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading tables…</div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>No tables yet. Create one to get started.</div>
      ) : (
        <div className={styles.list}>
          {filtered.map((table) => {
            const isExpanded = expandedIds.has(table.id);
            const label = table.display_name || table.name;
            return (
              <div
                key={table.id}
                className={[styles.tableCard, isExpanded ? styles.tableCardExpanded : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className={styles.tableRow}>
                  <div className={styles.tableInfo}>
                    <div className={styles.tableName}>{label}</div>
                    <div className={styles.tableMeta}>{table.application_name}</div>
                  </div>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    title="Edit table"
                    aria-label={`Edit ${label}`}
                    onClick={() => openProperty(table.id)}
                  >
                    <EditIcon />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    title={isExpanded ? "Collapse" : "Expand"}
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                    onClick={() => toggleExpand(table.id)}
                  >
                    {isExpanded ? "▴" : "▾"}
                  </button>
                </div>

                {isExpanded ? (
                  <div className={styles.subList}>
                    <button
                      type="button"
                      className={styles.subItem}
                      onClick={() => openProperty(table.id, "fields")}
                    >
                      <span className={styles.subChevron}>▷</span>
                      Fields
                    </button>
                    <button type="button" className={styles.subItem} disabled>
                      <span className={styles.subChevron}>▷</span>
                      Relationships
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <CreateTableModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void loadTables()}
      />
    </>
  );
}
