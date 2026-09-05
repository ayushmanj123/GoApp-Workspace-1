/** Parses Parent.Item.FieldName or ThisItem.FieldName from a default binding formula. */
export function parseParentItemField(formula: string): string | null {
  const trimmed = formula.trim();
  const parentMatch = trimmed.match(/^Parent\.Item\.([A-Za-z][A-Za-z0-9]*)$/i);
  if (parentMatch) return parentMatch[1];
  const thisItemMatch = trimmed.match(/^ThisItem\.([A-Za-z][A-Za-z0-9]*)$/i);
  if (thisItemMatch) return thisItemMatch[1];
  const quotedMatch = trimmed.match(/^ThisItem\.['"]([^'"]+)['"]$/i);
  if (quotedMatch) return quotedMatch[1];
  const bracketMatch = trimmed.match(/^ThisItem\[['"]([^'"]+)['"]\]$/i);
  if (bracketMatch) return bracketMatch[1];
  const dottedMatch = trimmed.match(/^ThisItem\.(.+)$/i);
  if (dottedMatch) return dottedMatch[1].trim();
  return null;
}

/** True when the formula is a form-item field binding. */
export function isFormItemFieldBinding(formula: string): boolean {
  return parseParentItemField(formula) !== null;
}
