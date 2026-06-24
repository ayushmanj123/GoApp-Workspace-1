import type { Screen } from "../api/screens-api";

/**
 * Picks the first unused ScreenN name for an application.
 */
export function buildUniqueScreenName(screens: Screen[]): string {
  const existing = new Set(screens.map((screen) => screen.name.toLowerCase()));

  for (let index = 1; index <= 9999; index += 1) {
    const candidate = `Screen${index}`;
    if (!existing.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  return `Screen_${Date.now()}`;
}

export function buildFallbackScreenName(): string {
  return `Screen_${Date.now()}`;
}
