export function formatAuditDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatCreatedBy(value?: string | null): string {
  if (!value) return "—";
  return value.slice(0, 8);
}

export function getCreatedOn(record: {
  CreatedOn?: string;
  created_on?: string;
}): string | undefined {
  return record.CreatedOn ?? record.created_on;
}

export function getCreatedBy(record: {
  CreatedBy?: string | null;
  created_by?: string | null;
}): string | null | undefined {
  return record.CreatedBy ?? record.created_by;
}
