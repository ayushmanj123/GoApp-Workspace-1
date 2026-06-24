/** Parses Parent.Item.FieldName from a default binding formula. */
export function parseParentItemField(formula: string): string | null {
  const match = formula.trim().match(/^Parent\.Item\.([A-Za-z][A-Za-z0-9]*)$/i);
  return match ? match[1] : null;
}
