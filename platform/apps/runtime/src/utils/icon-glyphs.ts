export const ICON_GLYPHS: Record<string, string> = {
  star: "★",
  heart: "♥",
  check: "✓",
  home: "⌂",
  user: "👤",
  settings: "⚙",
};

export function iconGlyph(name: string): string {
  const key = name.trim().toLowerCase();
  if (!key) return "";
  return ICON_GLYPHS[key] ?? (name.length <= 2 ? name : "●");
}
