import { useMemo, useState } from "react";
import type { EntityFieldRecord } from "../../../api/entities-api";
import { recordsApi, type ImportResult } from "../../../api/records-api";
import shellStyles from "../../preview/RuntimePreviewModal.module.css";
import modalStyles from "../../layout/InsertComponentModal.module.css";

interface ImportRecordsModalProps {
  open: boolean;
  entityId: string;
  fields: EntityFieldRecord[];
  onClose: () => void;
  onImported: () => void;
}

async function fileToCsvFile(file: File): Promise<File> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type.includes("csv") || file.type === "text/plain") {
    return file;
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const workbook = XLSX.read(buf, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("Workbook has no sheets");
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return new File([csv], file.name.replace(/\.(xlsx|xls)$/i, ".csv"), {
      type: "text/csv",
    });
  }
  throw new Error("Unsupported file type. Use CSV or Excel (.xlsx).");
}

export function ImportRecordsModal({
  open,
  entityId,
  fields,
  onClose,
  onImported,
}: ImportRecordsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dryRunOk, setDryRunOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldNames = useMemo(() => fields.map((f) => f.name), [fields]);
  const requiredUnmapped = useMemo(() => {
    const mapped = new Set(Object.values(mapping).filter(Boolean));
    return fields.filter((f) => f.is_required && !mapped.has(f.name));
  }, [fields, mapping]);
  const mappedCount = useMemo(
    () => Object.values(mapping).filter(Boolean).length,
    [mapping],
  );

  if (!open) return null;

  const onFile = async (f: File | null) => {
    setFile(f);
    setCsvFile(null);
    setResult(null);
    setDryRunOk(false);
    setError(null);
    if (!f) {
      setHeaders([]);
      setMapping({});
      return;
    }
    try {
      const csv = await fileToCsvFile(f);
      setCsvFile(csv);
      const text = await csv.text();
      const firstLine = text.split(/\r?\n/)[0] ?? "";
      const cols = firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      setHeaders(cols);
      const auto: Record<string, string> = {};
      for (const col of cols) {
        const match = fieldNames.find((n) => n.toLowerCase() === col.toLowerCase());
        if (match) auto[col] = match;
      }
      setMapping(auto);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
      setHeaders([]);
    }
  };

  const runImport = async (dryRun: boolean) => {
    if (!csvFile) return;
    if (mappedCount === 0) {
      setError("Map at least one column before running import.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await recordsApi.importCsv(entityId, csvFile, mapping, dryRun);
      setResult(res);
      if (dryRun) {
        setDryRunOk(res.failed === 0);
      } else if (res.created > 0) {
        onImported();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setDryRunOk(false);
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
        aria-label="Import records"
      >
        <header className={shellStyles.header}>
          <div className={shellStyles.title}>Import CSV / Excel</div>
        </header>
        <div className={modalStyles.body}>
          <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
            File
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: "block", marginTop: 4 }}
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {file ? (
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 8 }}>
              {file.name}
              {csvFile && file !== csvFile ? " (converted to CSV)" : ""}
            </p>
          ) : null}
          {headers.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Column mapping</div>
              {headers.map((header) => (
                <label
                  key={header}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 6,
                    fontSize: 12,
                  }}
                >
                  <span style={{ minWidth: 100 }}>{header}</span>
                  <select
                    value={mapping[header] ?? ""}
                    onChange={(e) => {
                      setDryRunOk(false);
                      setResult(null);
                      setMapping((m) => ({ ...m, [header]: e.target.value }));
                    }}
                    style={{ flex: 1, padding: "4px 6px" }}
                  >
                    <option value="">(skip)</option>
                    {fields.map((f) => (
                      <option key={f.id} value={f.name}>
                        {f.display_name || f.name}
                        {f.is_required ? " *" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {mappedCount === 0 ? (
                <p style={{ fontSize: 12, color: "var(--color-warning)" }}>
                  No columns mapped yet.
                </p>
              ) : null}
              {requiredUnmapped.length > 0 ? (
                <p style={{ fontSize: 12, color: "var(--color-warning)" }}>
                  Required fields unmapped:{" "}
                  {requiredUnmapped.map((f) => f.display_name || f.name).join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}
          {result ? (
            <div style={{ fontSize: 12, marginBottom: 8 }}>
              <p>
                {result.dryRun ? "Dry run" : "Import"}: {result.created} ok, {result.failed}{" "}
                failed
              </p>
              {result.errors && result.errors.length > 0 ? (
                <div
                  style={{
                    maxHeight: 140,
                    overflow: "auto",
                    border: "1px solid var(--color-border)",
                    borderRadius: 6,
                    padding: 8,
                    marginTop: 6,
                  }}
                >
                  {result.errors.map((e, i) => (
                    <div key={`${e.row}-${i}`} style={{ color: "var(--color-danger)" }}>
                      Row {e.row}: {e.message}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--color-success)" }}>No row errors.</p>
              )}
            </div>
          ) : null}
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
              disabled={saving || !csvFile || mappedCount === 0}
              onClick={() => void runImport(true)}
            >
              Dry run
            </button>
            <button
              type="button"
              className={modalStyles.itemBtn}
              style={{ width: "auto", marginLeft: 8 }}
              disabled={saving || !csvFile || !dryRunOk || mappedCount === 0}
              title={!dryRunOk ? "Run a successful dry run first" : undefined}
              onClick={() => void runImport(false)}
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
