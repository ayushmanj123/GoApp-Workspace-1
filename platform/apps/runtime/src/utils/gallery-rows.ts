export function readItemsFormula(property: unknown): string {
  if (Array.isArray(property)) {
    return "";
  }
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    return typeof formula === "string" ? formula.trim() : "";
  }
  if (typeof property === "string") {
    return property.trim();
  }
  return "";
}

/** Prefer lowercase items, then PascalCase Items (server render merge). */
export function coalesceItemsProp(
  props: Record<string, unknown> | null | undefined,
): unknown {
  if (!props) return undefined;
  if (props.items !== undefined) return props.items;
  if (props.Items !== undefined) return props.Items;
  return undefined;
}

export function firstStringLikeField(record: Record<string, unknown>): string {
  for (const value of Object.values(record)) {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }
  return "";
}

/** Stable React key for gallery/datatable rows — avoids remount on field edits. */
export function galleryRowKey(record: Record<string, unknown>, index: number): string {
  const id = record.recordId ?? record.RecordId ?? null;
  if (id != null && String(id).trim() !== "") {
    return `row-${String(id)}`;
  }
  return `row-idx-${index}`;
}

/** Converts a Power Fx table result into record objects for gallery rows. */
export function normalizeGalleryRecords(result: unknown): Record<string, unknown>[] {
  if (result === null || result === undefined) return [];
  if (!Array.isArray(result)) return [];

  return result.map((item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return { ...(item as Record<string, unknown>) };
    }
    if (typeof item === "string") return { Name: item };
    if (item === null || item === undefined) return {};
    return { Value: item };
  });
}

/** Converts a Power Fx table result into display strings for gallery rows. */
export function normalizeGalleryRows(result: unknown): string[] {
  return normalizeGalleryRecords(result).map(firstStringLikeField);
}
