import React, { useCallback, useMemo } from "react";
import {
  useGallerySelectionStore,
} from "../formula/formula-context";
import { useResolvedGalleryRecords } from "../hooks/use-resolved-gallery-items";
import { usePagedRecords } from "../hooks/use-paged-records";
import { readItemsFormula } from "../utils/gallery-rows";
import { useIsDesignSurface } from "../design-mode-context";
import { fillParentStyle } from "../utils/control-layout";
import { useRuntime } from "../runtime-hooks";
import { selectGalleryItem } from "../runtime-session-client";

const STUDIO_PLACEHOLDER_RECORDS = [
  { Name: "Alice", Status: "Active" },
  { Name: "Bob", Status: "Pending" },
];

function inferColumns(records: Record<string, unknown>[]): string[] {
  if (records.length === 0) {
    return ["Name"];
  }
  const keys = new Set<string>();
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!key.startsWith("_")) {
        keys.add(key);
      }
    }
  }
  const columns = Array.from(keys);
  return columns.length > 0 ? columns.sort() : ["Name"];
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
  items?: unknown;
  pageSize?: unknown;
  disabled?: boolean;
  readOnly?: boolean;
}> = ({ name, items, pageSize, disabled = false }) => {
  const records = useResolvedGalleryRecords(items);
  const selectionStore = useGallerySelectionStore();
  const isStudioCanvas = useIsDesignSurface();
  const { appId, sessionId, runtimeUnavailable } = useRuntime();
  const hasFormula = Boolean(readItemsFormula(items));
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
  const columns = useMemo(() => inferColumns(displayRecords), [displayRecords]);

  const handleRowClick = useCallback(
    (record: Record<string, unknown>, index: number) => {
      if (!canSelect) return;
      selectionStore.select(tableName, record);
      if (sessionId && appId && !runtimeUnavailable) {
        void selectGalleryItem({
          appId,
          sessionId,
          galleryName: tableName,
          index,
        }).catch((err) => console.error(err));
      }
    },
    [canSelect, tableName, selectionStore, sessionId, appId, runtimeUnavailable],
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
      <div style={{ flex: 1, overflow: "auto", border: "1px solid #d0d0d0", borderRadius: 4 }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
          }}
        >
          <thead>
            <tr>
              {columns.map((column) => (
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
            {visibleRecords.map((record, index) => (
              <tr
                key={`${index}-${JSON.stringify(record)}`}
                onClick={canSelect ? () => handleRowClick(record, index) : undefined}
                style={{
                  cursor: canSelect ? "pointer" : undefined,
                  background: isRowSelected(record) ? "#e8f0fe" : undefined,
                }}
              >
                {columns.map((column) => (
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
