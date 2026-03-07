/** Truncate a string to maxLen, padding with spaces if shorter. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str.padEnd(maxLen);
  return str.slice(0, maxLen - 1) + "…";
}

/** Truncate a string to maxLen without padding. */
export function truncateNoPad(str: string, maxLen: number): string {
  if (maxLen <= 0) return "";
  if (str.length <= maxLen) return str;
  if (maxLen === 1) return "…";
  return str.slice(0, maxLen - 1) + "…";
}
