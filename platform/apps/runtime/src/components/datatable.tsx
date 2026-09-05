import React, { useCallback, useMemo } from "react";
import {
  useGallerySelectionStore,
} from "../formula/formula-context";
import { useSessionGalleryItems } from "../hooks/use-session-gallery-items";
import { usePagedRecords } from "../hooks/use-paged-records";
import { galleryRowKey, readItemsFormula } from "../utils/gallery-rows";
import { useIsDesignSurface } from "../design-mode-context";
import { fillParentStyle } from "../utils/control-layout";
import { useRuntime } from "../runtime-hooks";
import { selectGalleryItem } from "../runtime-session-client";

const STUDIO_PLACEHOLDER_RECORDS = [
  { Name: "Alice", Status: "Active" },
  { Name: "Bob", Status: "Pending" },
];

const NOISE_COLUMN_KEYS = new Set([
  "recordid",
  "entityid",
  "version",
  "_rid",
  "_self",
]);

function readColumnsProp(value: unknown): string[] {
  let raw: unknown = value;
  if (raw && typeof raw === "object" && "value" in raw) {
    raw = (raw as { value?: unknown }).value;
  }
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function inferColumns(records: Record<string, unknown>[]): string[] {
  if (records.length === 0) {
    return [];
  }
  const keys = new Set<string>();
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (key.startsWith("_")) continue;
      if (NOISE_COLUMN_KEYS.has(key.toLowerCase())) continue;
      keys.add(key);
    }
  }
  return Array.from(keys).sort();
}

function resolveColumns(
  records: Record<string, unknown>[],
  columnsProp: unknown,
  columnHints?: string[],
): string[] {
  const fromProp = readColumnsProp(columnsProp);
  if (fromProp.length > 0) return fromProp;
  if (Array.isArray(columnHints) && columnHints.length > 0) {
    return columnHints.map(String).filter(Boolean);
  }
  const inferred = inferColumns(records);
  return inferred.length > 0 ? inferred : ["Name"];
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export const DataTable: React.FC<{
  name?: string;
  controlId?: string;
  items?: unknown;
  Items?: unknown;
  pageSize?: unknown;
  columns?: unknown;
  columnHints?: string[];
  /** Studio Data-pane property; refresh UX lives in Property Panel, not runtime UI. */
  showRefresh?: unknown;
  disabled?: boolean;
  readOnly?: boolean;
}> = ({
  name,
  controlId,
  items,
  Items,
  pageSize,
  columns,
  columnHints,
  disabled = false,
}) => {
  const itemsProp = items ?? Items;
  const { records, loading, error } = useSessionGalleryItems(
    controlId ?? name,
    itemsProp,
  );
  const selectionStore = useGallerySelectionStore();
  const isStudioCanvas = useIsDesignSurface();
  const { appId, sessionId, runtimeUnavailable, bumpFormRefresh } = useRuntime();
  const hasFormula = Boolean(readItemsFormula(itemsProp));
  const tableName = name?.trim() ?? "";
  const canSelect = Boolean(tableName) && !isStudioCanvas && !disabled;
  const selectedRecord = canSelect ? selectionStore.get(tableName) : undefined;

  const displayRecords =
    records.length > 0
      ? records
      : isStudioCanvas && hasFormula
        ? STUDIO_PLACEHOLDER_RECORDS
        : [];

  const { visibleRecords, hasMore, loadMore } = usePagedRecords(
    displayRecords,
    pageSize,
  );
  const resolvedColumns = useMemo(
    () => resolveColumns(displayRecords, columns, columnHints),
    [displayRecords, columns, columnHints],
  );

  const handleRowClick = useCallback(
    (record: Record<string, unknown>, index: number) => {
      if (!canSelect) return;
      selectionStore.select(tableName, record);
      if (sessionId && appId && !runtimeUnavailable) {
        void selectGalleryItem({
          appId,
          sessionId,
          galleryName: controlId ?? tableName,
          index,
        })
          .then(() => {
            bumpFormRefresh?.();
          })
          .catch((err) => console.error(err));
      }
    },
    [
      canSelect,
      tableName,
      controlId,
      selectionStore,
      sessionId,
      appId,
      runtimeUnavailable,
      bumpFormRefresh,
    ],
  );

  const handleRowKeyDown = useCallback(
    (
      event: React.KeyboardEvent,
      record: Record<string, unknown>,
      index: number,
    ) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleRowClick(record, index);
      }
    },
    [handleRowClick],
  );

  const isRowSelected = useCallback(
    (record: Record<string, unknown>) => {
      if (!selectedRecord) return false;
      return JSON.stringify(selectedRecord) === JSON.stringify(record);
    },
    [selectedRecord],
  );

  return (
    <div style={{ ...fillParentStyle(), display: "flex", flexDirection: "column" }}>
      {error && !isStudioCanvas ? (
        <div style={{ marginBottom: 4, fontSize: 11, color: "#b00020" }}>{error}</div>
      ) : null}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          border: "1px solid #d0d0d0",
          borderRadius: 4,
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
          }}
        >
          <thead>
            <tr>
              {resolvedColumns.map((column) => (
                <th
                  key={column}
                  style={{
                    textAlign: "left",
                    padding: "6px 8px",
                    borderBottom: "1px solid #ddd",
                    background: "#f5f5f5",
                    position: "sticky",
                    top: 0,
                  }}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRecords.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={Math.max(resolvedColumns.length, 1)}
                  style={{ padding: "12px 8px", color: "#666", fontSize: 12 }}
                >
                  {error
                    ? "Unable to load records."
                    : isStudioCanvas
                      ? "No sample rows"
                      : "No records"}
                </td>
              </tr>
            ) : null}
            {visibleRecords.map((record, index) => (
              <tr
                key={galleryRowKey(record, index)}
                role={canSelect ? "row" : undefined}
                tabIndex={canSelect ? 0 : undefined}
                aria-selected={canSelect ? isRowSelected(record) : undefined}
                onClick={
                  canSelect ? () => handleRowClick(record, index) : undefined
                }
                onKeyDown={
                  canSelect
                    ? (event) => handleRowKeyDown(event, record, index)
                    : undefined
                }
                style={{
                  cursor: canSelect ? "pointer" : undefined,
                  background: isRowSelected(record) ? "#e8f0fe" : undefined,
                  outline: isRowSelected(record) ? "1px solid #4A90D9" : undefined,
                }}
              >
                {resolvedColumns.map((column) => (
                  <td
                    key={column}
                    style={{
                      padding: "6px 8px",
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    {formatCell(record[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && visibleRecords.length === 0 ? (
        <div style={{ marginTop: 4, fontSize: 12, color: "#666" }}>Loading…</div>
      ) : null}
      {hasMore ? (
        <button
          type="button"
          onClick={loadMore}
          style={{
            marginTop: 4,
            alignSelf: "flex-start",
            padding: "4px 10px",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Load more
        </button>
      ) : null}
    </div>
  );
};

export default DataTable;
