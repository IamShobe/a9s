/**
 * Returns an ANSI color for a row based on its creation timestamp.
 * - < 1 hour ago: bright green (very new)
 * - < 24 hours: undefined (normal)
 * - < 7 days: undefined (normal)
 * - > 30 days: gray (old)
 */
export function getAgeBandColor(isoDateString: string | undefined): string | undefined {
  if (!isoDateString) return undefined;
  const date = new Date(isoDateString);
  if (isNaN(date.getTime())) return undefined;
  const ageMs = Date.now() - date.getTime();
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;
  if (ageMs < hourMs) return "green";
  if (ageMs > 30 * dayMs) return "gray";
  return undefined;
}

/**
 * Returns `{ rowColor: color }` if there's an age band color, or `{}` otherwise.
 * Use with spread operator to avoid exactOptionalPropertyTypes issues.
 */
export function ageBandProps(isoDateString: string | undefined): { rowColor: string } | Record<string, never> {
  const color = getAgeBandColor(isoDateString);
  return color !== undefined ? { rowColor: color } : {};
}
