import { readPropertyValue } from "../../utils/control-properties";

/** Static display text for designer previews (no formula evaluation). */
export function readDesignerDisplay(
  property: unknown,
  fallback = "",
): string {
  if (typeof property === "string") {
    return property;
  }
  if (property && typeof property === "object" && "formula" in property) {
    const formula = (property as { formula?: unknown }).formula;
    const text = typeof formula === "string" ? formula.trim() : "";
    return text ? `[${text}]` : fallback;
  }
  const staticValue = readPropertyValue("text", property);
  if (typeof staticValue === "string" && staticValue) {
    return staticValue;
  }
  if (typeof staticValue === "number" || typeof staticValue === "boolean") {
    return String(staticValue);
  }
  return fallback;
}
