/** Parses Parent.Item.FieldName or ThisItem.FieldName from a default binding formula. */
export function parseParentItemField(formula: string): string | null {
  const trimmed = formula.trim();
  const parentMatch = trimmed.match(/^Parent\.Item\.([A-Za-z][A-Za-z0-9]*)$/i);
  if (parentMatch) return parentMatch[1];
  const thisItemMatch = trimmed.match(/^ThisItem\.([A-Za-z][A-Za-z0-9]*)$/i);
  if (thisItemMatch) return thisItemMatch[1];
  return null;
}

/** True when the formula is a form-item field binding. */
export function isFormItemFieldBinding(formula: string): boolean {
  return parseParentItemField(formula) !== null;
}
