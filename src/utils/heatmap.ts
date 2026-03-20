import type { TableRow } from "../types.js";

/** Check if a column is predominantly numeric (>= 80% of non-empty values parse as numbers) */
export function isNumericColumn(rows: TableRow[], colKey: string): boolean {
  const values = rows
    .map((r) => r.cells[colKey]?.displayName ?? "")
    .filter((v) => v !== "" && v !== "-");
  if (values.length === 0) return false;
  const numericCount = values.filter((v) => !isNaN(parseFloat(v.replace(/[,KMGTkmgtB% ]/g, "")))).length;
  return numericCount / values.length >= 0.8;
}

/** Parse a display value to a float, stripping common suffixes */
export function parseNumericValue(v: string): number {
  const cleaned = v.replace(/,/g, "").trim();
  const match = cleaned.match(/^([\d.]+)\s*([KMGTkmgt]?[Bb]?)?/);
  if (!match) return NaN;
  const num = parseFloat(match[1]!);
  const suffix = (match[2] ?? "").toUpperCase();
  if (suffix.startsWith("K")) return num * 1000;
  if (suffix.startsWith("M")) return num * 1000 * 1000;
  if (suffix.startsWith("G")) return num * 1000 * 1000 * 1000;
  return num;
}

/** Compute per-row heatmap colors for a numeric column */
export function computeHeatmapColors(rows: TableRow[], colKey: string): Map<string, string> {
  const result = new Map<string, string>();
  const values = rows.map((r) => ({
    id: r.id,
    val: parseNumericValue(r.cells[colKey]?.displayName ?? ""),
  })).filter((x) => !isNaN(x.val));

  if (values.length === 0) return result;

  const min = Math.min(...values.map((x) => x.val));
  const max = Math.max(...values.map((x) => x.val));
  if (max === min) return result;

  const colors = ["green", "cyan", "yellow", "red"];

  for (const { id, val } of values) {
    const ratio = (val - min) / (max - min);
    const idx = Math.min(Math.floor(ratio * colors.length), colors.length - 1);
    result.set(id, colors[idx]!);
  }

  return result;
}
