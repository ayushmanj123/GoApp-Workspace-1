import React, { useCallback } from "react";
import ControlRenderer from "../control-renderer";
import {
  GalleryRowProvider,
  useGallerySelectionStore,
} from "../formula/formula-context";
import { useResolvedGalleryRecords } from "../hooks/use-resolved-gallery-items";
import { usePagedRecords } from "../hooks/use-paged-records";
import {
  firstStringLikeField,
  readItemsFormula,
} from "../utils/gallery-rows";
import { useIsDesignSurface } from "../design-mode-context";
import { fillParentStyle, relativeContainerStyle } from "../utils/control-layout";
import type { ControlPackage } from "../runtime-types";
import { useRuntime } from "../runtime-hooks";
import { selectGalleryItem } from "../runtime-session-client";

const STUDIO_PLACEHOLDER_RECORDS = [{ Name: "Item 1" }, { Name: "Item 2" }];

export const Gallery: React.FC<{
  name?: string;
  items?: unknown;
  pageSize?: unknown;
  templateControls?: ControlPackage[];
  disabled?: boolean;
  readOnly?: boolean;
}> = ({ name, items, pageSize, templateControls = [], disabled = false }) => {
  const records = useResolvedGalleryRecords(items);
  const selectionStore = useGallerySelectionStore();
  const isStudioCanvas = useIsDesignSurface();
  const { appId, sessionId, runtimeUnavailable } = useRuntime();
  const hasFormula = Boolean(readItemsFormula(items));
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
          galleryName,
          index,
        }).catch((err) => console.error(err));
      }
    },
    [canSelect, galleryName, selectionStore, sessionId, appId, runtimeUnavailable],
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
        style={{
          flex: 1,
          overflow: "auto",
          border: "1px solid #d0d0d0",
          borderRadius: 4,
          padding: 4,
        }}
      >
      {visibleRecords.map((record, index) => (
        <div
          key={`${index}-${JSON.stringify(record)}`}
          onClick={canSelect ? () => handleRowClick(record, index) : undefined}
          style={{
            position: "relative",
            minHeight: 32,
            padding: "4px 6px",
            borderBottom: "1px solid #eee",
            marginBottom: 2,
            cursor: canSelect ? "pointer" : undefined,
            background: isRowSelected(record) ? "#e8f0fe" : undefined,
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
