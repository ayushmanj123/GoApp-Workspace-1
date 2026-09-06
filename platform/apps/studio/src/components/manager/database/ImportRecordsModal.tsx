import { useMemo, useState } from "react";
import type { EntityFieldRecord } from "../../../api/entities-api";
import { recordsApi } from "../../../api/records-api";
import shellStyles from "../../preview/RuntimePreviewModal.module.css";
import modalStyles from "../../layout/InsertComponentModal.module.css";

interface ImportRecordsModalProps {
  open: boolean;
  entityId: string;
  fields: EntityFieldRecord[];
  onClose: () => void;
  onImported: () => void;
}

export function ImportRecordsModal({
  open,
  entityId,
  fields,
  onClose,
  onImported,
}: ImportRecordsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldNames = useMemo(() => fields.map((f) => f.name), [fields]);

  if (!open) return null;

  const onFile = async (f: File | null) => {
    setFile(f);
    setResult(null);
    setError(null);
    if (!f) {
      setHeaders([]);
      return;
    }
    const text = await f.text();
    const firstLine = text.split(/\r?\n/)[0] ?? "";
    const cols = firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    setHeaders(cols);
    const auto: Record<string, string> = {};
    for (const col of cols) {
      const match = fieldNames.find((n) => n.toLowerCase() === col.toLowerCase());
      if (match) auto[col] = match;
    }
    setMapping(auto);
  };

  const runImport = async (dryRun: boolean) => {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const res = await recordsApi.importCsv(entityId, file, mapping, dryRun);
      setResult(
        `${dryRun ? "Dry run" : "Import"}: ${res.created} ok, ${res.failed} failed` +
          (res.errors?.length
            ? ` — ${res.errors
                .slice(0, 5)
                .map((e) => `row ${e.row}: ${e.message}`)
                .join("; ")}`
            : ""),
      );
      if (!dryRun && res.created > 0) onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={shellStyles.overlay} onMouseDown={onClose}>
      <div
        className={`${shellStyles.dialog} ${modalStyles.dialog}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Import CSV"
      >
        <header className={shellStyles.header}>
          <div className={shellStyles.title}>Import CSV</div>
        </header>
        <div className={modalStyles.body}>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            File
            <input
              type="file"
              accept=".csv,text/csv"
              style={{ display: "block", marginTop: 4 }}
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {headers.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Column mapping</div>
              {headers.map((header) => (
                <label
                  key={header}
                  style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, fontSize: 12 }}
                >
                  <span style={{ minWidth: 100 }}>{header}</span>
                  <select
                    value={mapping[header] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [header]: e.target.value }))
                    }
                    style={{ flex: 1, padding: "4px 6px" }}
                  >
                    <option value="">(skip)</option>
                    {fields.map((f) => (
                      <option key={f.id} value={f.name}>
                        {f.display_name || f.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ) : null}
          {result ? <p style={{ fontSize: 12 }}>{result}</p> : null}
          {error ? (
            <p className={modalStyles.empty} style={{ color: "var(--color-danger)" }}>
              {error}
            </p>
          ) : null}
          <div className={modalStyles.footer}>
            <button type="button" className={modalStyles.cancelBtn} onClick={onClose} disabled={saving}>
              Close
            </button>
            <button
              type="button"
              className={modalStyles.itemBtn}
              style={{ width: "auto", marginLeft: 8 }}
              disabled={saving || !file}
              onClick={() => void runImport(true)}
            >
              Dry run
            </button>
            <button
              type="button"
              className={modalStyles.itemBtn}
              style={{ width: "auto", marginLeft: 8 }}
              disabled={saving || !file}
              onClick={() => void runImport(false)}
            >
              {saving ? "Importing…" : "Import"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
