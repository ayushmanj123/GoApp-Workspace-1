import React, { useCallback } from "react";
import ControlRenderer from "../control-renderer";
import {
  GalleryRowProvider,
  useGallerySelectionStore,
} from "../formula/formula-context";
import { useResolvedGalleryRecords } from "../hooks/use-resolved-gallery-items";
import {
  firstStringLikeField,
  readItemsFormula,
} from "../utils/gallery-rows";
import { useNavigationStore } from "../runtime-hooks";
import type { ControlPackage } from "../runtime-types";

const STUDIO_PLACEHOLDER_RECORDS = [{ Name: "Item 1" }, { Name: "Item 2" }];

export const Gallery: React.FC<{
  name?: string;
  items?: unknown;
  templateControls?: ControlPackage[];
}> = ({ name, items, templateControls = [] }) => {
  const records = useResolvedGalleryRecords(items);
  const selectionStore = useGallerySelectionStore();
  const navigationStore = useNavigationStore();
  const isStudioCanvas = navigationStore === null;
  const hasFormula = Boolean(readItemsFormula(items));
  const galleryName = name?.trim() ?? "";
  const canSelect = Boolean(galleryName) && !isStudioCanvas;
  const selectedRecord = canSelect ? selectionStore.get(galleryName) : undefined;

  const displayRecords =
    records.length > 0
      ? records
      : isStudioCanvas && hasFormula
        ? STUDIO_PLACEHOLDER_RECORDS
        : [];

  const hasTemplate = templateControls.length > 0;

  const handleRowClick = useCallback(
    (record: Record<string, unknown>) => {
      if (!canSelect) return;
      selectionStore.select(galleryName, record);
    },
    [canSelect, galleryName, selectionStore],
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
        display: "flex",
        flexDirection: "column",
        gap: 4,
        overflow: "auto",
        width: "100%",
        height: "100%",
        border: "1px solid #d0d0d0",
        borderRadius: 4,
        padding: 4,
        boxSizing: "border-box",
      }}
    >
      {displayRecords.map((record, index) => (
        <div
          key={`${index}-${JSON.stringify(record)}`}
          onClick={canSelect ? () => handleRowClick(record) : undefined}
          style={{
            padding: "6px 8px",
            borderBottom: "1px solid #eee",
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
                />
              ))}
            </GalleryRowProvider>
          ) : (
            firstStringLikeField(record)
          )}
        </div>
      ))}
    </div>
  );
};

export default Gallery;
