import React, { useCallback } from "react";
import ControlRenderer from "../control-renderer";
import {
  GalleryRowProvider,
  useGallerySelectionStore,
} from "../formula/formula-context";
import { useSessionGalleryItems } from "../hooks/use-session-gallery-items";
import { usePagedRecords } from "../hooks/use-paged-records";
import {
  firstStringLikeField,
  galleryRowKey,
  readItemsFormula,
} from "../utils/gallery-rows";
import { useIsDesignSurface } from "../design-mode-context";
import { fillParentStyle } from "../utils/control-layout";
import type { ControlPackage } from "../runtime-types";
import { useRuntime } from "../runtime-hooks";
import { selectGalleryItem } from "../runtime-session-client";

const STUDIO_PLACEHOLDER_RECORDS = [{ Name: "Item 1" }, { Name: "Item 2" }];

export const Gallery: React.FC<{
  name?: string;
  controlId?: string;
  items?: unknown;
  Items?: unknown;
  pageSize?: unknown;
  templateControls?: ControlPackage[];
  disabled?: boolean;
  readOnly?: boolean;
}> = ({
  name,
  controlId,
  items,
  Items,
  pageSize,
  templateControls = [],
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
  const galleryName = name?.trim() ?? "";
  const canSelect = Boolean(galleryName) && !isStudioCanvas && !disabled;
  const selectedRecord = canSelect ? selectionStore.get(galleryName) : undefined;

  const displayRecords =
    records.length > 0
      ? records
      : isStudioCanvas && hasFormula
        ? STUDIO_PLACEHOLDER_RECORDS
        : [];

  const hasTemplate = templateControls.length > 0;
  const { visibleRecords, hasMore, loadMore } = usePagedRecords(
    displayRecords,
    pageSize,
  );

  const handleRowClick = useCallback(
    (record: Record<string, unknown>, index: number) => {
      if (!canSelect) return;
      selectionStore.select(galleryName, record);
      if (sessionId && appId && !runtimeUnavailable) {
        void selectGalleryItem({
          appId,
          sessionId,
          galleryName: controlId ?? galleryName,
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
      galleryName,
      controlId,
      selectionStore,
      sessionId,
      appId,
      runtimeUnavailable,
      bumpFormRefresh,
    ],
  );

  const isRowSelected = useCallback(
    (record: Record<string, unknown>) => {
      if (!selectedRecord) return false;
      return JSON.stringify(selectedRecord) === JSON.stringify(record);
    },
    [selectedRecord],
  );

  return (
    <div
      style={{
        ...fillParentStyle(),
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        role={canSelect ? "listbox" : undefined}
        aria-label={galleryName || "Gallery"}
        style={{
          flex: 1,
          overflow: "auto",
          border: "1px solid #d0d0d0",
          borderRadius: 4,
          padding: 4,
        }}
      >
        {visibleRecords.length === 0 && !loading ? (
          <div style={{ padding: "8px 6px", color: "#666", fontSize: 12 }}>
            {error
              ? "Unable to load items."
              : isStudioCanvas
                ? "No sample items"
                : "No items"}
          </div>
        ) : null}
        {visibleRecords.map((record, index) => (
          <div
            key={galleryRowKey(record, index)}
            role={canSelect ? "option" : undefined}
            aria-selected={canSelect ? isRowSelected(record) : undefined}
            tabIndex={canSelect ? 0 : undefined}
            onClick={canSelect ? () => handleRowClick(record, index) : undefined}
            onKeyDown={
              canSelect
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleRowClick(record, index);
                    }
                  }
                : undefined
            }
            style={{
              position: "relative",
              minHeight: 32,
              padding: "4px 6px",
              borderBottom: "1px solid #eee",
              marginBottom: 2,
              cursor: canSelect ? "pointer" : undefined,
              background: isRowSelected(record) ? "#e8f0fe" : undefined,
              outline: isRowSelected(record) ? "1px solid #4A90D9" : undefined,
            }}
          >
            {hasTemplate ? (
              <GalleryRowProvider thisItem={record}>
                {templateControls.map((control) => (
                  <ControlRenderer
                    key={`${index}-${control.id}`}
                    control={control}
                    nested
                  />
                ))}
              </GalleryRowProvider>
            ) : (
              firstStringLikeField(record)
            )}
          </div>
        ))}
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

export default Gallery;
