export function getFormulaApiUrl(): string | undefined {
  if (typeof import.meta !== "undefined") {
    const viteUrl = (import.meta as ImportMeta & { env?: Record<string, string> })
      .env?.VITE_FORMULA_API_URL;
    if (viteUrl?.trim()) {
      return viteUrl.trim().replace(/\/$/, "");
    }
  }

  if (typeof process !== "undefined" && process.env?.FORMULA_API_URL?.trim()) {
    return process.env.FORMULA_API_URL.trim().replace(/\/$/, "");
  }

  return undefined;
}
