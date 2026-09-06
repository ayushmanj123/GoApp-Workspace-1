import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ENTITY_FIELD_TYPES,
  entitiesApi,
  type EntityFieldRecord,
  type EntityFieldType,
  type EntityKeyRecord,
  type EntityRelationshipRecord,
} from "../../../api/entities-api";
import { recordsApi } from "../../../api/records-api";
import {
  Button,
  SearchInput,
  IconAdd,
  IconEdit,
  IconEye,
  IconKey,
  IconMoreVert,
  IconData,
} from "../../ui";
import { useTenantTablesContext } from "./TenantTablesContext";
import { AddTableFieldModal } from "./AddTableFieldModal";
import { EditFieldModal } from "./EditFieldModal";
import { TableRecordsPanel } from "./TableRecordsPanel";
import { colorForApp } from "./diagram/types";
import {
  formatAuditDate,
  formatCreatedBy,
  getCreatedBy,
  getCreatedOn,
} from "./database-utils";
import styles from "./database-manager.module.css";

type SchemaTab = "fields" | "relationships" | "keys" | "properties";

function formatRelative(iso?: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(t).toLocaleDateString();
}

function typePill(type: EntityFieldType): { label: string; cls: string } {
  switch (type) {
    case "lookup":
      return { label: "Lookup / Relational", cls: styles.pillLookup };
    case "choice":
    case "choices":
      return { label: type === "choice" ? "Single Select" : "Multi Select", cls: styles.pillChoice };
    case "decimal":
    case "currency":
      return { label: type === "currency" ? "Currency" : "Decimal", cls: styles.pillDecimal };
    case "number":
    case "integer":
      return { label: type === "integer" ? "Integer" : "Number", cls: styles.pillNum };
    case "boolean":
      return { label: "Boolean", cls: styles.pillBool };
    case "date":
    case "datetime":
      return { label: type === "datetime" ? "DateTime" : "Date", cls: styles.pillDate };
    case "email":
    case "phone":
    case "url":
    case "multiline":
    case "text":
      return {
        label:
          type === "email"
            ? "Email"
            : type === "phone"
              ? "Phone"
              : type === "url"
                ? "URL"
                : type === "multiline"
                  ? "Multiline"
                  : "Text",
        cls: styles.pillText,
      };
    default:
      return { label: type, cls: styles.pillDefault };
  }
}

function parseSection(raw: string | null): SchemaTab {
  if (raw === "relationships" || raw === "keys" || raw === "properties" || raw === "fields") {
    return raw;
  }
  return "fields";
}

export function TablePropertyView() {
  const { entityId } = useParams<{ entityId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get("section");
  const viewParam = searchParams.get("view");
  const view = viewParam === "records" ? "records" : "schema";
  const activeTab = parseSection(sectionParam);

  const setView = (next: "schema" | "records") => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === "records") {
          params.set("view", "records");
        } else {
          params.delete("view");
        }
        return params;
      },
      { replace: true },
    );
  };

  const setTab = (tab: SchemaTab) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete("view");
        if (tab === "fields") params.delete("section");
        else params.set("section", tab);
        return params;
      },
      { replace: true },
    );
  };

  const {
    getTable,
    fieldsByEntityId,
    fieldsLoading,
    loadFields,
    refreshFields,
    loadTables,
    loading: tablesLoading,
    tables,
  } = useTenantTablesContext();

  const table = entityId ? getTable(entityId) : undefined;
  const fields = entityId ? (fieldsByEntityId[entityId] ?? []) : [];
  const fieldsAreLoading = entityId ? fieldsLoading[entityId] : false;
  const relationshipFields = fields.filter((field) => field.field_type === "lookup");

  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [addRelationshipOpen, setAddRelationshipOpen] = useState(false);
  const [editField, setEditField] = useState<EntityFieldRecord | null>(null);
  const [keys, setKeys] = useState<EntityKeyRecord[]>([]);
  const [nnRels, setNnRels] = useState<EntityRelationshipRecord[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [pluralName, setPluralName] = useState("");
  const [description, setDescription] = useState("");
  const [primaryFieldId, setPrimaryFieldId] = useState("");
  const [propsSaving, setPropsSaving] = useState(false);
  const [propsMsg, setPropsMsg] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("");
  const [keyFieldIds, setKeyFieldIds] = useState<string[]>([]);
  const [nnName, setNnName] = useState("");
  const [nnOtherId, setNnOtherId] = useState("");
  const [fieldSearch, setFieldSearch] = useState("");
  const [fieldTypeFilter, setFieldTypeFilter] = useState<string>("all");
  const [recordTotal, setRecordTotal] = useState<number | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!entityId) return;
    void loadFields(entityId);
    void entitiesApi.listKeys(entityId).then((d) => setKeys(d.items ?? []));
    void entitiesApi.listRelationships(entityId).then((d) => setNnRels(d.items ?? []));
    void recordsApi
      .list(entityId, { limit: 1, offset: 0 })
      .then((r) => setRecordTotal(r.total))
      .catch(() => setRecordTotal(0));
  }, [entityId, loadFields]);

  useEffect(() => {
    if (!table) return;
    setDisplayName(table.display_name || "");
    setPluralName(table.plural_display_name || "");
    setDescription(table.description || "");
    setPrimaryFieldId(table.primary_field_id || "");
  }, [table]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreOpen]);

  const filteredFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    return fields.filter((f) => {
      if (fieldTypeFilter !== "all" && f.field_type !== fieldTypeFilter) return false;
      if (!q) return true;
      const hay = [
        f.name,
        f.display_name,
        f.field_type,
        f.is_required ? "required" : "",
        f.is_unique ? "unique" : "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [fields, fieldSearch, fieldTypeFilter]);

  if (tablesLoading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  if (!table) {
    return (
      <div className={styles.error}>
        <p>Table not found.</p>
        <Link to="/studio/database" className={styles.backLink}>
          Back to tables
        </Link>
      </div>
    );
  }

  const title = table.display_name || table.name;
  const color = colorForApp(table.application_name || table.name);
  const modifiedRel = formatRelative(table.modified_on ?? table.ModifiedOn ?? null);
  const modifiedBy = formatCreatedBy(
    (table as { ModifiedBy?: string | null; modified_by?: string | null }).ModifiedBy ??
      (table as { modified_by?: string | null }).modified_by ??
      getCreatedBy(table),
  );
  const relBadge = relationshipFields.length + nnRels.length;

  const saveProps = async () => {
    if (!entityId) return;
    setPropsSaving(true);
    setPropsMsg(null);
    try {
      await entitiesApi.update(entityId, {
        display_name: displayName.trim(),
        plural_display_name: pluralName.trim(),
        description: description.trim(),
        primary_field_id: primaryFieldId || undefined,
      });
      setPropsMsg("Saved");
      await loadTables();
    } catch (err) {
      setPropsMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setPropsSaving(false);
    }
  };

  const deleteTable = async () => {
    if (!entityId) return;
    let depsNote = "";
    try {
      const deps = await entitiesApi.listDependents(entityId);
      if (deps.items?.length) {
        depsNote = `\n\nLookup dependents: ${deps.items.map((d) => d.name).join(", ")}`;
      }
    } catch {
      /* ignore */
    }
    if (!window.confirm(`Delete table "${title}"?${depsNote}`)) return;
    try {
      await entitiesApi.delete(entityId);
      await loadTables();
      navigate("/studio/database");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const deleteField = async (field: EntityFieldRecord) => {
    if (!window.confirm(`Delete field "${field.display_name || field.name}"?`)) return;
    try {
      await entitiesApi.deleteField(field.id);
      if (entityId) void refreshFields(entityId);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const createKey = async () => {
    if (!entityId || !keyName.trim() || keyFieldIds.length === 0) return;
    await entitiesApi.createKey(entityId, { name: keyName.trim(), field_ids: keyFieldIds });
    setKeyName("");
    setKeyFieldIds([]);
    const d = await entitiesApi.listKeys(entityId);
    setKeys(d.items ?? []);
  };

  const createNn = async () => {
    if (!entityId || !nnName.trim() || !nnOtherId) return;
    await entitiesApi.createRelationship({
      name: nnName.trim(),
      left_entity_id: entityId,
      right_entity_id: nnOtherId,
    });
    setNnName("");
    setNnOtherId("");
    const d = await entitiesApi.listRelationships(entityId);
    setNnRels(d.items ?? []);
  };

  const tabs: { id: SchemaTab; label: string; badge?: number }[] = [
    { id: "fields", label: "Fields", badge: fields.length },
    { id: "relationships", label: "Relationships & Lookups", badge: relBadge },
    { id: "keys", label: "Keys & Indexes", badge: keys.length },
    { id: "properties", label: "Table Properties & Metadata" },
  ];

  return (
    <>
      <div className={styles.tableDetailTop}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Link to="/studio/database" className={styles.backLink} style={{ marginBottom: 0 }}>
            ← Back to Tables
          </Link>
          <div className={styles.tableDetailBreadcrumb}>
            <span>schema</span>
            <span className={styles.tableDetailBreadcrumbSep}>·</span>
            <span>{table.application_name || "App"}</span>
            <span className={styles.tableDetailBreadcrumbSep}>/</span>
            <span className={styles.tableDetailBreadcrumbActive}>{title}</span>
          </div>
        </div>
        {modifiedRel ? (
          <div className={styles.tableDetailModified}>
            Last modified {modifiedRel}
            {modifiedBy !== "—" ? ` by ${modifiedBy}` : ""}
          </div>
        ) : null}
      </div>

      <div className={styles.tableDetailHero}>
        <div className={styles.tableDetailHeroLeft}>
          <div className={styles.tableDetailIcon} style={{ background: color }}>
            <IconData size={22} />
          </div>
          <div>
            <div className={styles.tableDetailTitleRow}>
              <h1 className={styles.tableDetailTitle}>{title}</h1>
              <span className={styles.tableDetailSlug}>{table.name}</span>
            </div>
            <p className={styles.tableDetailDesc}>
              {table.description?.trim() || "No description"}
            </p>
          </div>
        </div>
        <div className={styles.tableDetailHeroActions}>
          <Button
            variant="outlined"
            size="sm"
            onClick={() => setView(view === "schema" ? "records" : "schema")}
          >
            <IconEye size={14} />
            {view === "schema" ? "View Records" : "View Schema"}
            {view === "schema" && recordTotal !== null ? (
              <span className={styles.recordCountBadge}>{recordTotal.toLocaleString()}</span>
            ) : null}
          </Button>
          <div className={styles.moreMenuWrap} ref={moreRef}>
            <button
              type="button"
              className={styles.iconBtn}
              title="More actions"
              onClick={() => setMoreOpen((o) => !o)}
            >
              <IconMoreVert size={16} />
            </button>
            {moreOpen ? (
              <div className={styles.moreMenu}>
                <button
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => {
                    setMoreOpen(false);
                    void deleteTable();
                  }}
                >
                  Delete table
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {view === "records" ? (
        <TableRecordsPanel entityId={entityId!} fields={fields} />
      ) : (
        <>
          <div className={styles.schemaTabs} role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={[
                  styles.schemaTab,
                  activeTab === tab.id ? styles.schemaTabActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setTab(tab.id)}
              >
                {tab.id === "keys" ? <IconKey size={14} /> : null}
                {tab.label}
                {tab.badge !== undefined ? (
                  <span className={styles.schemaTabBadge}>{tab.badge}</span>
                ) : null}
              </button>
            ))}
          </div>

          <div className={styles.schemaPanel}>
            {activeTab === "fields" ? (
              <>
                <div className={styles.fieldsToolbar}>
                  <div className={styles.fieldsToolbarSearch}>
                    <SearchInput
                      fullWidth
                      placeholder="Filter fields by name, type, or constraint..."
                      value={fieldSearch}
                      onChange={(e) => setFieldSearch(e.target.value)}
                    />
                  </div>
                  <select
                    className={styles.fieldsTypeSelect}
                    value={fieldTypeFilter}
                    onChange={(e) => setFieldTypeFilter(e.target.value)}
                  >
                    <option value="all">All Types</option>
                    {ENTITY_FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <Button variant="primary" size="sm" onClick={() => setAddFieldOpen(true)}>
                    <IconAdd size={14} /> New Field
                  </Button>
                </div>

                {fieldsAreLoading ? (
                  <div className={styles.gridEmpty}>Loading fields…</div>
                ) : filteredFields.length === 0 ? (
                  <div className={styles.gridEmpty}>No fields match your filters</div>
                ) : (
                  <div className={styles.schemaGridWrap}>
                    <table className={styles.schemaGrid}>
                      <thead>
                        <tr>
                          <th>Field Name</th>
                          <th>Data Type</th>
                          <th>Required</th>
                          <th>Unique</th>
                          <th>Relationships</th>
                          <th>Created</th>
                          <th aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFields.map((field) => {
                          const pill = typePill(field.field_type);
                          const relatedTable =
                            field.field_type === "lookup" && field.related_entity_id
                              ? getTable(field.related_entity_id)
                              : undefined;
                          const isPk = table.primary_field_id === field.id;
                          const relatedLabel = relatedTable
                            ? `${relatedTable.name}.id`
                            : field.related_entity_id
                              ? "…"
                              : null;
                          return (
                            <tr key={field.id}>
                              <td>
                                <div className={styles.fieldNameCell}>
                                  {isPk ? <span className={styles.fieldPkStar}>★</span> : null}
                                  <span>{field.display_name || field.name}</span>
                                </div>
                              </td>
                              <td>
                                <span className={`${styles.fieldTypePill} ${pill.cls}`}>
                                  {pill.label}
                                </span>
                              </td>
                              <td>
                                {field.is_required ? (
                                  <span className={styles.constraintPill}>Required</span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td>
                                {field.is_unique ? (
                                  <span className={styles.constraintPill}>Unique</span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td>
                                {relatedLabel ? (
                                  <span className={styles.relPill}>→ {relatedLabel}</span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td>{formatAuditDate(getCreatedOn(field))}</td>
                              <td>
                                <button
                                  type="button"
                                  className={styles.iconBtn}
                                  title="Edit field"
                                  onClick={() => setEditField(field)}
                                >
                                  <IconEdit size={14} />
                                </button>
                                <button
                                  type="button"
                                  className={styles.iconBtn}
                                  title="Delete field"
                                  onClick={() => void deleteField(field)}
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className={styles.fieldsFooter}>
                  <button
                    type="button"
                    className={styles.fieldsFooterBtn}
                    onClick={() => setAddFieldOpen(true)}
                  >
                    <IconAdd size={14} /> Append new column attribute
                  </button>
                  <span className={styles.fieldsFooterStatus}>
                    Showing {filteredFields.length} of {fields.length} schema attributes
                  </span>
                </div>
              </>
            ) : null}

            {activeTab === "relationships" ? (
              <>
                <div className={styles.detailPanelActions}>
                  <Button variant="primary" size="sm" onClick={() => setAddRelationshipOpen(true)}>
                    <IconAdd size={14} /> New lookup
                  </Button>
                </div>
                <div className={styles.detailPanelTitle}>Lookup relationships</div>
                {fieldsAreLoading ? (
                  <div className={styles.gridEmpty}>Loading relationships…</div>
                ) : relationshipFields.length === 0 ? (
                  <div className={styles.gridEmpty}>No lookup relationships yet.</div>
                ) : (
                  <div className={styles.schemaGridWrap}>
                    <table className={styles.schemaGrid}>
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Related Table</th>
                          <th>Delete behavior</th>
                          <th aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {relationshipFields.map((field) => {
                          const related = field.related_entity_id
                            ? getTable(field.related_entity_id)
                            : undefined;
                          return (
                            <tr key={field.id}>
                              <td className={styles.fieldNameCell}>
                                {field.display_name || field.name}
                              </td>
                              <td>
                                {related
                                  ? related.display_name || related.name
                                  : field.related_entity_id ?? "—"}
                              </td>
                              <td>
                                <span className={styles.constraintPill}>
                                  {(field.delete_behavior ?? "restrict").toUpperCase()}
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className={styles.iconBtn}
                                  onClick={() => setEditField(field)}
                                >
                                  <IconEdit size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className={styles.nnBlock}>
                  <div className={styles.detailPanelTitle}>Many-to-many</div>
                  <div className={styles.nnForm}>
                    <input
                      placeholder="Relationship name"
                      value={nnName}
                      onChange={(e) => setNnName(e.target.value)}
                    />
                    <select value={nnOtherId} onChange={(e) => setNnOtherId(e.target.value)}>
                      <option value="">Related table…</option>
                      {tables
                        .filter((t) => t.id !== entityId)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.display_name || t.name}
                          </option>
                        ))}
                    </select>
                    <Button variant="outlined" size="sm" onClick={() => void createNn()}>
                      Create N:N
                    </Button>
                  </div>
                  {nnRels.length === 0 ? (
                    <div className={styles.gridEmpty}>No many-to-many relationships</div>
                  ) : (
                    <ul className={styles.simpleList}>
                      {nnRels.map((rel) => {
                        const otherId =
                          rel.left_entity_id === entityId
                            ? rel.right_entity_id
                            : rel.left_entity_id;
                        const other = getTable(otherId);
                        return (
                          <li key={rel.id}>
                            {rel.name} ↔ {other?.display_name || other?.name || otherId}
                            <button
                              type="button"
                              className={styles.iconBtn}
                              onClick={() =>
                                void entitiesApi.deleteRelationship(rel.id).then(async () => {
                                  if (entityId) {
                                    const d = await entitiesApi.listRelationships(entityId);
                                    setNnRels(d.items ?? []);
                                  }
                                })
                              }
                            >
                              ×
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            ) : null}

            {activeTab === "keys" ? (
              <>
                <div className={styles.detailPanelTitle}>Alternate keys</div>
                <div className={styles.nnForm}>
                  <input
                    placeholder="Key name"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                  />
                  <select
                    multiple
                    value={keyFieldIds}
                    onChange={(e) =>
                      setKeyFieldIds(Array.from(e.target.selectedOptions, (o) => o.value))
                    }
                    style={{ minHeight: 72 }}
                  >
                    {fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.display_name || f.name}
                      </option>
                    ))}
                  </select>
                  <Button variant="outlined" size="sm" onClick={() => void createKey()}>
                    Add key
                  </Button>
                </div>
                {keys.length === 0 ? (
                  <div className={styles.gridEmpty}>No alternate keys</div>
                ) : (
                  <ul className={styles.simpleList}>
                    {keys.map((key) => (
                      <li key={key.id}>
                        <IconKey size={14} /> {key.name}
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() =>
                            void entitiesApi.deleteKey(key.id).then(async () => {
                              if (entityId) {
                                const d = await entitiesApi.listKeys(entityId);
                                setKeys(d.items ?? []);
                              }
                            })
                          }
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}

            {activeTab === "properties" ? (
              <>
                <div className={styles.detailPanelTitle}>Table properties</div>
                <label className={styles.propLabel}>
                  Display name
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </label>
                <label className={styles.propLabel}>
                  Plural display name
                  <input value={pluralName} onChange={(e) => setPluralName(e.target.value)} />
                </label>
                <label className={styles.propLabel}>
                  Description
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                </label>
                <label className={styles.propLabel}>
                  Primary column
                  <select
                    value={primaryFieldId}
                    onChange={(e) => setPrimaryFieldId(e.target.value)}
                  >
                    <option value="">—</option>
                    {fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.display_name || f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={propsSaving}
                  onClick={() => void saveProps()}
                >
                  {propsSaving ? "Saving…" : "Save properties"}
                </Button>
                {propsMsg ? <span className={styles.propsMsg}>{propsMsg}</span> : null}
              </>
            ) : null}
          </div>

          <AddTableFieldModal
            open={addFieldOpen}
            entityId={entityId ?? null}
            entityName={title}
            onClose={() => setAddFieldOpen(false)}
            onCreated={() => {
              if (entityId) void refreshFields(entityId);
            }}
          />

          <AddTableFieldModal
            open={addRelationshipOpen}
            entityId={entityId ?? null}
            entityName={title}
            initialFieldType="lookup"
            title="New Relationship"
            onClose={() => setAddRelationshipOpen(false)}
            onCreated={() => {
              if (entityId) void refreshFields(entityId);
            }}
          />

          <EditFieldModal
            open={editField !== null}
            field={editField}
            onClose={() => setEditField(null)}
            onSaved={() => {
              if (entityId) void refreshFields(entityId);
            }}
          />
        </>
      )}
    </>
  );
}
