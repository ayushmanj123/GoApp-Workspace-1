import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { recordsApi } from "../../../api/records-api";
import { Button, SearchInput, IconAdd, IconEdit, IconEye, IconKey, IconMoreVert, IconChevronDown } from "../../ui";
import { colorForApp } from "./diagram/types";
import { useTenantTablesContext } from "./TenantTablesContext";
import { CreateTableModal } from "./CreateTableModal";
import { AddTableFieldModal } from "./AddTableFieldModal";
import styles from "./database-manager.module.css";

function formatRelative(iso?: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Updated ${days}d ago`;
  return `Updated ${new Date(t).toLocaleDateString()}`;
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  );
}

export function TablesListView() {
  const navigate = useNavigate();
  const { tables, loading, error, loadTables, fieldsByEntityId, loadFields, refreshFields } =
    useTenantTablesContext();
  const [search, setSearch] = useState("");
  const [appFilter, setAppFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [addFieldEntityId, setAddFieldEntityId] = useState<string | null>(null);
  const [recordTotals, setRecordTotals] = useState<Record<string, number>>({});
  const [recordLoading, setRecordLoading] = useState<Record<string, boolean>>({});
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    for (const t of tables) {
      if (!fieldsByEntityId[t.id]) void loadFields(t.id);
    }
  }, [tables, fieldsByEntityId, loadFields]);

  useEffect(() => {
    if (!filterOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [filterOpen]);

  const apps = useMemo(() => {
    const set = new Set<string>();
    for (const t of tables) set.add(t.application_name || "Other");
    return [...set].sort();
  }, [tables]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tables.filter((t) => {
      if (appFilter && (t.application_name || "Other") !== appFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.display_name.toLowerCase().includes(q) ||
        t.application_name.toLowerCase().includes(q)
      );
    });
  }, [tables, search, appFilter]);

  const fetchRecords = async (entityId: string) => {
    if (recordTotals[entityId] !== undefined || recordLoading[entityId]) return;
    setRecordLoading((prev) => ({ ...prev, [entityId]: true }));
    try {
      const res = await recordsApi.list(entityId, { limit: 1, offset: 0 });
      setRecordTotals((prev) => ({ ...prev, [entityId]: res.total }));
    } catch {
      setRecordTotals((prev) => ({ ...prev, [entityId]: 0 }));
    } finally {
      setRecordLoading((prev) => ({ ...prev, [entityId]: false }));
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        void fetchRecords(id);
      }
      return next;
    });
  };

  const addFieldTable = tables.find((t) => t.id === addFieldEntityId) ?? null;

  return (
    <>
      <div className={styles.tablesToolbar}>
        <div className={styles.tablesSearch}>
          <SearchInput
            fullWidth
            placeholder="Search tables by name or module..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.tablesFilterWrap} ref={filterRef}>
          <button
            type="button"
            className={[
              styles.tablesFilterBtn,
              appFilter ? styles.tablesFilterBtnActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setFilterOpen((o) => !o)}
          >
            <FilterIcon />
            Filters
            {appFilter ? <span className={styles.tablesFilterDot} /> : null}
          </button>
          {filterOpen ? (
            <div className={styles.tablesFilterMenu}>
              <button
                type="button"
                className={[
                  styles.tablesFilterOption,
                  !appFilter ? styles.tablesFilterOptionActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  setAppFilter(null);
                  setFilterOpen(false);
                }}
              >
                All modules
              </button>
              {apps.map((app) => (
                <button
                  key={app}
                  type="button"
                  className={[
                    styles.tablesFilterOption,
                    appFilter === app ? styles.tablesFilterOptionActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    setAppFilter(app);
                    setFilterOpen(false);
                  }}
                >
                  <span>{app}</span>
                  <span>
                    {tables.filter((t) => (t.application_name || "Other") === app).length}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
          <IconAdd size={14} /> Create Table
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
            const color = colorForApp(table.application_name || table.name);
            const fieldCount = fieldsByEntityId[table.id]?.length;
            const recordCount = recordTotals[table.id];
            const updated = formatRelative(table.modified_on ?? table.ModifiedOn ?? null);
            const metaParts: string[] = [];
            if (fieldCount !== undefined) {
              metaParts.push(`${fieldCount} Custom Field${fieldCount === 1 ? "" : "s"}`);
            }
            if (recordLoading[table.id]) {
              metaParts.push("… records");
            } else if (recordCount !== undefined) {
              metaParts.push(`${recordCount.toLocaleString()} records`);
            }

            return (
              <div
                key={table.id}
                className={[
                  styles.tableListCard,
                  isExpanded ? styles.tableListCardExpanded : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div
                  className={styles.tableListRow}
                  onClick={() => toggleExpand(table.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpand(table.id);
                    }
                  }}
                >
                  <div
                    className={styles.tableListIcon}
                    style={{ background: color }}
                    aria-hidden
                  >
                    <IconKey size={16} />
                  </div>
                  <div className={styles.tableListInfo}>
                    <div className={styles.tableListTitleRow}>
                      <span className={styles.tableListName}>{label}</span>
                      <span className={styles.tableSlug}>{table.name}</span>
                      <span className={styles.tableModulePill}>
                        {table.application_name || "Other"}
                      </span>
                    </div>
                    <div className={styles.tableMetaLine}>
                      {metaParts.length > 0 ? metaParts.join(" • ") : "Schema entity"}
                    </div>
                  </div>
                  <div className={styles.tableListRight}>
                    {updated ? <span className={styles.tableUpdated}>{updated}</span> : null}
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title="Open table"
                      aria-label={`Open ${label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/studio/database/tables/${table.id}`);
                      }}
                    >
                      <IconMoreVert size={16} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title={isExpanded ? "Collapse" : "Expand"}
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(table.id);
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          transform: isExpanded ? "rotate(180deg)" : undefined,
                          transition: "transform 150ms ease",
                        }}
                      >
                        <IconChevronDown size={14} />
                      </span>
                    </button>
                  </div>
                </div>

                {isExpanded ? (
                  <div className={styles.tableExpandFooter}>
                    <button
                      type="button"
                      className={styles.tableActionBtn}
                      onClick={() => navigate(`/studio/database/tables/${table.id}`)}
                    >
                      <IconEdit size={14} /> Edit Table Schema
                    </button>
                    <button
                      type="button"
                      className={styles.tableActionBtn}
                      onClick={() =>
                        navigate(`/studio/database/tables/${table.id}?view=records`)
                      }
                    >
                      <IconEye size={14} /> View Records
                      {recordCount !== undefined ? ` (${recordCount.toLocaleString()})` : ""}
                    </button>
                    <button
                      type="button"
                      className={styles.tableActionBtn}
                      onClick={() =>
                        navigate(`/studio/database/tables/${table.id}?section=keys`)
                      }
                    >
                      <IconKey size={14} /> Manage Keys
                    </button>
                    <button
                      type="button"
                      className={`${styles.tableActionBtn} ${styles.tableActionBtnPrimary}`}
                      onClick={() => setAddFieldEntityId(table.id)}
                    >
                      <IconAdd size={14} /> Add Custom Field
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
        onCreated={() => {
          setCreateOpen(false);
          void loadTables();
        }}
      />

      <AddTableFieldModal
        open={!!addFieldEntityId}
        entityId={addFieldEntityId}
        entityName={addFieldTable?.display_name || addFieldTable?.name || ""}
        onClose={() => setAddFieldEntityId(null)}
        onCreated={() => {
          if (addFieldEntityId) void refreshFields(addFieldEntityId);
          setAddFieldEntityId(null);
        }}
      />
    </>
  );
}
