import { useCallback, useEffect, useMemo, useState } from "react";

function readPositiveInt(property: unknown, fallback = 0): number {
  if (typeof property === "number" && property > 0) {
    return Math.floor(property);
  }
  if (property && typeof property === "object") {
    const record = property as { value?: unknown; formula?: unknown };
    if (typeof record.value === "number" && record.value > 0) {
      return Math.floor(record.value);
    }
    if (typeof record.formula === "string") {
      const parsed = Number.parseInt(record.formula.trim(), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return fallback;
}

export function usePagedRecords(
  records: Record<string, unknown>[],
  pageSizeProp: unknown,
) {
  const pageSize = readPositiveInt(pageSizeProp, 0);
  const [visibleCount, setVisibleCount] = useState(() =>
    pageSize > 0 ? Math.min(pageSize, records.length) : records.length,
  );

  useEffect(() => {
    setVisibleCount(
      pageSize > 0 ? Math.min(pageSize, records.length) : records.length,
    );
  }, [pageSize, records.length, records]);

  const effectiveCount =
    pageSize > 0 ? Math.min(visibleCount, records.length) : records.length;

  const visibleRecords = useMemo(
    () => records.slice(0, effectiveCount),
    [records, effectiveCount],
  );

  const hasMore = pageSize > 0 && effectiveCount < records.length;

  const loadMore = useCallback(() => {
    if (pageSize <= 0) {
      return;
    }
    setVisibleCount((current) => Math.min(current + pageSize, records.length));
  }, [pageSize, records.length]);

  return { visibleRecords, hasMore, loadMore, pageSize };
}
