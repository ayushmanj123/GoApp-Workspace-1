import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  entitiesApi,
  fieldOptions,
  type EntityFieldRecord,
  type EntityRelationshipRecord,
} from "../../../api/entities-api";
import {
  recordsApi,
  RecordsApiError,
  type EntityRecordItem,
} from "../../../api/records-api";
import { Button } from "../../ui";
import { ImportRecordsModal } from "./ImportRecordsModal";
import { LookupPicker, recordLabel } from "./LookupPicker";
import { useTenantTablesContext } from "./TenantTablesContext";
import styles from "./database-manager.module.css";

const PAGE_SIZE = 50;

interface TableRecordsPanelProps {
  entityId: string;
  fields: EntityFieldRecord[];
}

function emptyDraft(fields: EntityFieldRecord[]): Record<string, unknown> {
  const draft: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.field_type === "boolean") draft[field.name] = false;
    else if (field.field_type === "choices") draft[field.name] = [];
    else draft[field.name] = "";
  }
  return draft;
}

function coerceForSave(field: EntityFieldRecord, raw: unknown): unknown {
  if (raw === "" || raw === undefined) return null;
  switch (field.field_type) {
    case "number":
    case "integer":
    case "decimal":
    case "currency":
      return typeof raw === "number" ? raw : Number(raw);
    case "boolean":
      return Boolean(raw);
    case "choices":
      if (Array.isArray(raw)) return raw;
      if (typeof raw === "string") {
        return raw
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return [];
    default:
      return raw;
  }
}

export function TableRecordsPanel({ entityId, fields }: TableRecordsPanelProps) {
  const { getTable } = useTenantTablesContext();
  const [items, setItems] = useState<EntityRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [labelCache, setLabelCache] = useState<Record<string, string>>({});
  const [nnRels, setNnRels] = useState<EntityRelationshipRecord[]>([]);
  const [linksRecordId, setLinksRecordId] = useState<string | null>(null);

  const onLabelResolved = useCallback((recordId: string, label: string) => {
    setLabelCache((prev) => (prev[recordId] === label ? prev : { ...prev, [recordId]: label }));
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await recordsApi.list(entityId, { limit: PAGE_SIZE, offset });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load records");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [entityId, offset]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setVisibleIds(new Set(fields.map((f) => f.id)));
  }, [fields]);

  useEffect(() => {
    let cancelled = false;
    void entitiesApi
      .listRelationships(entityId)
      .then((d) => {
        if (!cancelled) setNnRels(d.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setNnRels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  // Prefetch lookup labels for visible cells
  useEffect(() => {
    const lookups = fields.filter((f) => f.field_type === "lookup" && f.related_entity_id);
    for (const field of lookups) {
      const relatedId = field.related_entity_id!;
      const ids = new Set<string>();
      for (const item of items) {
        const v = item.data[field.name];
        if (typeof v === "string" && v) ids.add(v);
      }
      if (ids.size === 0) continue;
      void recordsApi.list(relatedId, { limit: 100, offset: 0 }).then((res) => {
        setLabelCache((prev) => {
          const next = { ...prev };
          for (const r of res.items) {
            next[r.recordId] = recordLabel(r.data, r.recordId);
          }
          return next;
        });
      });
    }
  }, [items, fields]);

  const visibleFields = useMemo(
    () => fields.filter((f) => visibleIds.has(f.id)),
    [fields, visibleIds],
  );

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + items.length, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  const applyApiError = (err: unknown, fallback: string) => {
    if (err instanceof RecordsApiError) {
      if (err.details) setFieldErrors(err.details);
      setError(err.message || fallback);
      return;
    }
    setFieldErrors({});
    setError(err instanceof Error ? err.message : fallback);
  };

  const startEdit = (record: EntityRecordItem) => {
    setAdding(false);
    setEditingId(record.recordId);
    setDraft({ ...record.data });
    setFieldErrors({});
    setError(null);
  };

  const startAdd = () => {
    setEditingId(null);
    setAdding(true);
    setNewDraft(emptyDraft(fields));
    setFieldErrors({});
    setError(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const existing = items.find((r) => r.recordId === editingId);
    if (!existing) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const data: Record<string, unknown> = {};
      for (const field of fields) {
        data[field.name] = coerceForSave(field, draft[field.name]);
      }
      await recordsApi.update(entityId, editingId, data, existing.version);
      setEditingId(null);
      await reload();
    } catch (err) {
      if (err instanceof RecordsApiError && err.status === 409) {
        setError("Record was changed elsewhere. Reloading…");
        await reload();
      } else {
        applyApiError(err, "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  };

  const saveNew = async () => {
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const data: Record<string, unknown> = {};
      for (const field of fields) {
        const value = coerceForSave(field, newDraft[field.name]);
        if (value !== null && value !== undefined && value !== "") {
          data[field.name] = value;
        } else if (field.is_required) {
          data[field.name] = value;
        }
      }
      await recordsApi.create(entityId, data);
      setAdding(false);
      await reload();
    } catch (err) {
      applyApiError(err, "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async (recordId: string) => {
    if (!window.confirm("Delete this record?")) return;
    setSaving(true);
    try {
      await recordsApi.delete(entityId, recordId);
      if (linksRecordId === recordId) setLinksRecordId(null);
      await reload();
    } catch (err) {
      applyApiError(err, "Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  const renderEditor = (
    field: EntityFieldRecord,
    value: unknown,
    onChange: (v: unknown) => void,
  ) => {
    const opts = fieldOptions(field);
    const errMsg = fieldErrors[field.name];
    const wrap = (node: ReactNode) => (
      <div>
        {node}
        {errMsg ? (
          <div style={{ fontSize: 10, color: "var(--color-danger)", marginTop: 2 }}>{errMsg}</div>
        ) : null}
      </div>
    );

    if (field.field_type === "boolean") {
      return wrap(
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />,
      );
    }
    if (field.field_type === "choice" && opts.length) {
      return wrap(
        <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {opts.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>,
      );
    }
    if (field.field_type === "choices" && opts.length) {
      const selected = Array.isArray(value)
        ? (value as string[])
        : typeof value === "string" && value
          ? value.split("|").map((s) => s.trim()).filter(Boolean)
          : [];
      return wrap(
        <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 120, overflow: "auto" }}>
          {opts.map((o) => (
            <label key={o} style={{ fontSize: 11, display: "flex", gap: 4, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={selected.includes(o)}
                onChange={(e) => {
                  if (e.target.checked) onChange([...selected, o]);
                  else onChange(selected.filter((x) => x !== o));
                }}
              />
              {o}
            </label>
          ))}
        </div>,
      );
    }
    if (field.field_type === "lookup" && field.related_entity_id) {
      return wrap(
        <LookupPicker
          relatedEntityId={field.related_entity_id}
          value={String(value ?? "")}
          onChange={(id) => onChange(id)}
          labelCache={labelCache}
          onLabelResolved={onLabelResolved}
        />,
      );
    }
    if (field.field_type === "lookup") {
      return wrap(
        <input
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Related record UUID"
          style={{ width: "100%", minWidth: 120 }}
        />,
      );
    }
    if (field.field_type === "multiline") {
      return wrap(
        <textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", minWidth: 140 }}
        />,
      );
    }
    const inputType =
      field.field_type === "number" ||
      field.field_type === "integer" ||
      field.field_type === "decimal" ||
      field.field_type === "currency"
        ? "number"
        : field.field_type === "date"
          ? "date"
          : field.field_type === "datetime"
            ? "datetime-local"
            : "text";
    return wrap(
      <input
        type={inputType}
        value={String(value ?? "")}
        onChange={(e) =>
          onChange(inputType === "number" ? e.target.valueAsNumber : e.target.value)
        }
        style={{
          width: "100%",
          minWidth: 100,
          borderColor: errMsg ? "var(--color-danger)" : undefined,
        }}
      />,
    );
  };

  const formatFieldCell = (field: EntityFieldRecord, value: unknown): string => {
    if (value === null || value === undefined || value === "") return "—";
    if (field.field_type === "lookup" && typeof value === "string") {
      return labelCache[value] || value.slice(0, 8);
    }
    if (field.field_type === "choices" && Array.isArray(value)) {
      return value.join(", ");
    }
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  if (loading && items.length === 0 && !error) {
    return <div className={styles.gridEmpty}>Loading records…</div>;
  }

  return (
    <section className={styles.section}>
      <div className={`${styles.sectionHeader} ${styles.sectionHeaderStatic}`}>
        <span className={styles.sectionTitle}>Records</span>
        <div className={styles.sectionActions}>
          <Button variant="outlined" size="sm" onClick={() => setImportOpen(true)}>
            Import
          </Button>
          <Button variant="primary" size="sm" onClick={startAdd} disabled={adding}>
            + New
          </Button>
          {total > PAGE_SIZE ? (
            <div className={styles.pagination}>
              <span className={styles.pageInfo}>
                {pageStart}–{pageEnd} of {total}
              </span>
              <Button
                variant="outlined"
                size="sm"
                disabled={!hasPrev}
                onClick={() => setOffset((v) => Math.max(0, v - PAGE_SIZE))}
              >
                Prev
              </Button>
              <Button
                variant="outlined"
                size="sm"
                disabled={!hasNext}
                onClick={() => setOffset((v) => v + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.sectionBody}>
        {fields.length > 0 ? (
          <div className={styles.columnToggles}>
            {fields.map((field) => (
              <label key={field.id} className={styles.columnToggle}>
                <input
                  type="checkbox"
                  checked={visibleIds.has(field.id)}
                  onChange={(e) => {
                    setVisibleIds((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(field.id);
                      else next.delete(field.id);
                      return next;
                    });
                  }}
                />
                {field.display_name || field.name}
              </label>
            ))}
          </div>
        ) : null}

        {error ? <div className={styles.error}>{error}</div> : null}

        {items.length === 0 && !adding && !error ? (
          <div className={styles.gridEmpty}>
            <p>No records yet.</p>
            <Button variant="primary" size="sm" onClick={startAdd}>
              + Add record
            </Button>
          </div>
        ) : items.length === 0 && !adding && error ? (
          <div className={styles.gridEmpty}>
            <p>Could not load records. You can still try adding a new row.</p>
            <Button variant="primary" size="sm" onClick={startAdd}>
              + Add record
            </Button>
          </div>
        ) : (
          <div className={styles.gridWrap}>
            <table className={styles.grid}>
              <thead>
                <tr>
                  {visibleFields.map((field) => (
                    <th key={field.id}>{field.display_name || field.name}</th>
                  ))}
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {adding ? (
                  <tr>
                    {visibleFields.map((field) => (
                      <td key={field.id}>
                        {renderEditor(field, newDraft[field.name], (v) =>
                          setNewDraft((d) => ({ ...d, [field.name]: v })),
                        )}
                      </td>
                    ))}
                    <td>
                      <Button variant="primary" size="sm" disabled={saving} onClick={() => void saveNew()}>
                        Save
                      </Button>{" "}
                      <Button variant="outlined" size="sm" onClick={() => setAdding(false)}>
                        Cancel
                      </Button>
                    </td>
                  </tr>
                ) : null}
                {items.map((record) => {
                  const isEditing = editingId === record.recordId;
                  return (
                    <tr key={record.recordId}>
                      {visibleFields.map((field) => (
                        <td key={field.id}>
                          {isEditing
                            ? renderEditor(field, draft[field.name], (v) =>
                                setDraft((d) => ({ ...d, [field.name]: v })),
                              )
                            : formatFieldCell(field, record.data[field.name])}
                        </td>
                      ))}
                      <td>
                        {isEditing ? (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={saving}
                              onClick={() => void saveEdit()}
                            >
                              Save
                            </Button>{" "}
                            <Button variant="outlined" size="sm" onClick={() => setEditingId(null)}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              title="Edit"
                              onClick={() => startEdit(record)}
                            >
                              ✎
                            </button>
                            {nnRels.length > 0 ? (
                              <button
                                type="button"
                                className={styles.iconBtn}
                                title="Related links"
                                onClick={() =>
                                  setLinksRecordId((id) =>
                                    id === record.recordId ? null : record.recordId,
                                  )
                                }
                              >
                                ⇄
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className={styles.iconBtn}
                              title="Delete"
                              onClick={() => void removeRecord(record.recordId)}
                            >
                              ×
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {linksRecordId && nnRels.length > 0 ? (
          <RecordLinksPanel
            entityId={entityId}
            recordId={linksRecordId}
            relationships={nnRels}
            getTable={getTable}
            labelCache={labelCache}
            onLabelResolved={onLabelResolved}
            onClose={() => setLinksRecordId(null)}
          />
        ) : null}
      </div>

      <ImportRecordsModal
        open={importOpen}
        entityId={entityId}
        fields={fields}
        onClose={() => setImportOpen(false)}
        onImported={() => void reload()}
      />
    </section>
  );
}

function RecordLinksPanel({
  entityId,
  recordId,
  relationships,
  getTable,
  labelCache,
  onLabelResolved,
  onClose,
}: {
  entityId: string;
  recordId: string;
  relationships: EntityRelationshipRecord[];
  getTable: (id: string) => { display_name?: string; name: string } | undefined;
  labelCache: Record<string, string>;
  onLabelResolved: (id: string, label: string) => void;
  onClose: () => void;
}) {
  const [activeRelId, setActiveRelId] = useState(relationships[0]?.id ?? "");
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pickId, setPickId] = useState("");

  const rel = relationships.find((r) => r.id === activeRelId);
  const fromLeft = rel?.left_entity_id === entityId;
  const otherEntityId = rel
    ? fromLeft
      ? rel.right_entity_id
      : rel.left_entity_id
    : "";
  const otherTable = otherEntityId ? getTable(otherEntityId) : undefined;

  const reloadLinks = useCallback(async () => {
    if (!activeRelId) return;
    try {
      const ids = await recordsApi.listRelated(
        activeRelId,
        recordId,
        fromLeft ? "left" : "right",
      );
      setLinkedIds(ids);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to load links");
      setLinkedIds([]);
    }
  }, [activeRelId, recordId, fromLeft]);

  useEffect(() => {
    void reloadLinks();
  }, [reloadLinks]);

  const associate = async () => {
    if (!rel || !pickId) return;
    setBusy(true);
    setMsg(null);
    try {
      const left = fromLeft ? recordId : pickId;
      const right = fromLeft ? pickId : recordId;
      await recordsApi.associate(rel.id, left, right);
      setPickId("");
      await reloadLinks();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Associate failed");
    } finally {
      setBusy(false);
    }
  };

  const disassociate = async (otherId: string) => {
    if (!rel) return;
    setBusy(true);
    setMsg(null);
    try {
      const left = fromLeft ? recordId : otherId;
      const right = fromLeft ? otherId : recordId;
      await recordsApi.disassociate(rel.id, left, right);
      await reloadLinks();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Disassociate failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        background: "var(--color-bg-muted)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Related (N:N)</strong>
        <button type="button" className={styles.iconBtn} onClick={onClose}>
          ×
        </button>
      </div>
      <select
        value={activeRelId}
        onChange={(e) => setActiveRelId(e.target.value)}
        style={{ marginBottom: 8, fontSize: 12 }}
      >
        {relationships.map((r) => {
          const other =
            r.left_entity_id === entityId ? r.right_entity_id : r.left_entity_id;
          const t = getTable(other);
          return (
            <option key={r.id} value={r.id}>
              {r.name} ↔ {t?.display_name || t?.name || other.slice(0, 8)}
            </option>
          );
        })}
      </select>
      {msg ? <div className={styles.error}>{msg}</div> : null}
      <ul className={styles.simpleList}>
        {linkedIds.length === 0 ? (
          <li style={{ fontSize: 12, color: "var(--color-text-muted)" }}>No linked records</li>
        ) : (
          linkedIds.map((id) => (
            <li key={id}>
              {labelCache[id] || id.slice(0, 8)}
              <button
                type="button"
                className={styles.iconBtn}
                disabled={busy}
                onClick={() => void disassociate(id)}
              >
                ×
              </button>
            </li>
          ))
        )}
      </ul>
      {otherEntityId ? (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, marginBottom: 4 }}>
              Add {otherTable?.display_name || otherTable?.name || "record"}
            </div>
            <LookupPicker
              relatedEntityId={otherEntityId}
              value={pickId}
              onChange={setPickId}
              labelCache={labelCache}
              onLabelResolved={onLabelResolved}
            />
          </div>
          <Button variant="primary" size="sm" disabled={busy || !pickId} onClick={() => void associate()}>
            Associate
          </Button>
        </div>
      ) : null}
    </div>
  );
}
