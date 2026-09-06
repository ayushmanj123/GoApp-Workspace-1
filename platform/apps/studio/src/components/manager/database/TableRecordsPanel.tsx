import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fieldOptions,
  type EntityFieldRecord,
} from "../../../api/entities-api";
import {
  recordsApi,
  RecordsApiError,
  type EntityRecordItem,
} from "../../../api/records-api";
import { Button } from "../../ui";
import { ImportRecordsModal } from "./ImportRecordsModal";
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
  const [items, setItems] = useState<EntityRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);

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

  const visibleFields = useMemo(
    () => fields.filter((f) => visibleIds.has(f.id)),
    [fields, visibleIds],
  );

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + items.length, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  const startEdit = (record: EntityRecordItem) => {
    setAdding(false);
    setEditingId(record.recordId);
    setDraft({ ...record.data });
  };

  const startAdd = () => {
    setEditingId(null);
    setAdding(true);
    setNewDraft(emptyDraft(fields));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const existing = items.find((r) => r.recordId === editingId);
    if (!existing) return;
    setSaving(true);
    setError(null);
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
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  };

  const saveNew = async () => {
    setSaving(true);
    setError(null);
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
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async (recordId: string) => {
    if (!window.confirm("Delete this record?")) return;
    setSaving(true);
    try {
      await recordsApi.delete(entityId, recordId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
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
    if (field.field_type === "boolean") {
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    }
    if (field.field_type === "choice" && opts.length) {
      return (
        <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {opts.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }
    if (field.field_type === "lookup") {
      return (
        <input
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Related record UUID"
          style={{ width: "100%", minWidth: 120 }}
        />
      );
    }
    if (field.field_type === "multiline") {
      return (
        <textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", minWidth: 140 }}
        />
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
    return (
      <input
        type={inputType}
        value={String(value ?? "")}
        onChange={(e) =>
          onChange(inputType === "number" ? e.target.valueAsNumber : e.target.value)
        }
        style={{ width: "100%", minWidth: 100 }}
      />
    );
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
            Import CSV
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
                            : formatCell(record.data[field.name])}
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

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
