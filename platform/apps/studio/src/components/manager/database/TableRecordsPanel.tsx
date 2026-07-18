import { useEffect, useState } from "react";
import type { EntityFieldRecord } from "../../../api/entities-api";
import { recordsApi, type EntityRecordItem } from "../../../api/records-api";
import { Button } from "../../ui";
import styles from "./database-manager.module.css";

const PAGE_SIZE = 50;

interface TableRecordsPanelProps {
  entityId: string;
  fields: EntityFieldRecord[];
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function TableRecordsPanel({ entityId, fields }: TableRecordsPanelProps) {
  const [items, setItems] = useState<EntityRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void recordsApi
      .list(entityId, { limit: PAGE_SIZE, offset })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load records");
        setItems([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityId, offset]);

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + items.length, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  if (loading) {
    return <div className={styles.gridEmpty}>Loading records…</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (items.length === 0) {
    return <div className={styles.gridEmpty}>No records yet</div>;
  }

  return (
    <section className={styles.section}>
      <div className={`${styles.sectionHeader} ${styles.sectionHeaderStatic}`}>
        <span className={styles.sectionTitle}>Records</span>
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
      <div className={styles.sectionBody}>
        <div className={styles.gridWrap}>
          <table className={styles.grid}>
            <thead>
              <tr>
                {fields.map((field) => (
                  <th key={field.id}>{field.display_name || field.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((record) => (
                <tr key={record.recordId}>
                  {fields.map((field) => (
                    <td key={field.id}>{formatCellValue(record.data[field.name])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
