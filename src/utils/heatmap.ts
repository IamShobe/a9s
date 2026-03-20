import type { TableRow, ColumnDef, HeatmapColumnConfig } from "../types.js";

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

/** Parse a date display value to a timestamp (ms since epoch).
 *  Handles both ISO "YYYY-MM-DDTHH:mm:ss" and space-separated "YYYY-MM-DD HH:mm:ss". */
export function parseDateValue(v: string): number {
  const ts = Date.parse(v.replace(" ", "T"));
  return isNaN(ts) ? NaN : ts;
}

/** Compute per-row heatmap colors for a numeric column */
export function computeHeatmapColors(rows: TableRow[], colKey: string, parseValue = parseNumericValue): Map<string, string> {
  const result = new Map<string, string>();
  const values = rows.map((r) => ({
    id: r.id,
    val: parseValue(r.cells[colKey]?.displayName ?? ""),
  })).filter((x) => !isNaN(x.val));

  if (values.length === 0) return result;

  const min = Math.min(...values.map((x) => x.val));
  const max = Math.max(...values.map((x) => x.val));

  const colors = ["green", "cyan", "yellow", "red"];

  for (const { id, val } of values) {
    const ratio = max === min ? 0 : (val - min) / (max - min);
    const idx = Math.min(Math.floor(ratio * colors.length), colors.length - 1);
    result.set(id, colors[idx]!);
  }

  return result;
}

/** Select the right parse function for a heatmap column config */
export function getHeatmapParser(config: HeatmapColumnConfig): (v: string) => number {
  if (config.type === "date") return parseDateValue;
  if (config.type === "custom") return config.parse;
  return parseNumericValue;
}

/** Apply heatmap colors to all declared heatmap columns, returning updated rows */
export function applyHeatmapColors(rows: TableRow[], columns: ColumnDef[]): TableRow[] {
  const colMaps: { key: string; map: Map<string, string> }[] = [];
  for (const col of columns) {
    if (!col.heatmap) continue;
    const map = computeHeatmapColors(rows, col.key, getHeatmapParser(col.heatmap));
    if (map.size > 0) colMaps.push({ key: col.key, map });
  }
  if (colMaps.length === 0) return rows;

  return rows.map((row) => {
    const updatedCells = { ...row.cells };
    for (const { key, map } of colMaps) {
      const color = map.get(row.id);
      if (color) {
        updatedCells[key] = {
          ...(row.cells[key] ?? { displayName: "", type: "text" as const }),
          color,
          isHeatmap: true,
        };
      }
    }
    return { ...row, cells: updatedCells };
  });
}
