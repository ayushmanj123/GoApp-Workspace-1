export function readItemsFormula(property: unknown): string {
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    return typeof formula === "string" ? formula.trim() : "";
  }
  return "";
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
