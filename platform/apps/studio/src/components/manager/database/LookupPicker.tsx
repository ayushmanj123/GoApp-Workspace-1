import { useEffect, useMemo, useState } from "react";
import { recordsApi, type EntityRecordItem } from "../../../api/records-api";

export function recordLabel(data: Record<string, unknown> | undefined, fallbackId: string): string {
  if (!data) return fallbackId.slice(0, 8);
  for (const key of ["Name", "name", "display_name", "title", "Title"]) {
    const v = data[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  for (const v of Object.values(data)) {
    if (typeof v === "string" && v.trim()) return v;
  }
  return fallbackId.slice(0, 8);
}

interface LookupPickerProps {
  relatedEntityId: string;
  value: string;
  onChange: (recordId: string) => void;
  labelCache?: Record<string, string>;
  onLabelResolved?: (recordId: string, label: string) => void;
}

export function LookupPicker({
  relatedEntityId,
  value,
  onChange,
  labelCache,
  onLabelResolved,
}: LookupPickerProps) {
  const [options, setOptions] = useState<EntityRecordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void recordsApi
      .list(relatedEntityId, { limit: 100, offset: 0 })
      .then((res) => {
        if (cancelled) return;
        setOptions(res.items);
        for (const item of res.items) {
          onLabelResolved?.(item.recordId, recordLabel(item.data, item.recordId));
        }
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [relatedEntityId, onLabelResolved]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const label = recordLabel(o.data, o.recordId).toLowerCase();
      return label.includes(q) || o.recordId.toLowerCase().includes(q);
    });
  }, [options, query]);

  const selectedLabel =
    (value && labelCache?.[value]) ||
    (value
      ? recordLabel(options.find((o) => o.recordId === value)?.data, value)
      : "");

  return (
    <div style={{ minWidth: 160 }}>
      <input
        type="search"
        placeholder={loading ? "Loading…" : "Search…"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: "100%", marginBottom: 4, fontSize: 11, padding: "2px 4px" }}
      />
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", fontSize: 12 }}
        title={selectedLabel || value}
      >
        <option value="">—</option>
        {filtered.map((o) => (
          <option key={o.recordId} value={o.recordId}>
            {recordLabel(o.data, o.recordId)}
          </option>
        ))}
        {value && !filtered.some((o) => o.recordId === value) ? (
          <option value={value}>{selectedLabel || value.slice(0, 8)}</option>
        ) : null}
      </select>
    </div>
  );
}
