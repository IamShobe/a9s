import type { TableRow } from "../types.js";

/** Filter rows by case-insensitive substring match across all cell values. */
export function filterRowsByText(rows: TableRow[], filterText: string): TableRow[] {
  if (!filterText) return rows;
  const lower = filterText.toLowerCase();
  return rows.filter((row) =>
    Object.values(row.cells).some((cell) => {
      const value = cell?.displayName ?? "";
      return value.toLowerCase().includes(lower);
    }),
  );
}

export interface StatusSummary {
  total: number;
  byColor: { color: string; count: number; label: string }[];
}

const COLOR_LABELS: Record<string, string> = {
  green: "Running",
  yellow: "Pending",
  red: "Stopped/Failed",
  gray: "Inactive",
};

export function summarizeRowStatuses(rows: TableRow[]): StatusSummary {
  const total = rows.length;
  const colorCounts = new Map<string, number>();

  for (const row of rows) {
    for (const cell of Object.values(row.cells)) {
      if (typeof cell === "object" && cell?.color) {
        colorCounts.set(cell.color, (colorCounts.get(cell.color) ?? 0) + 1);
        break; // only count first colored cell per row
      }
    }
  }

  const byColor = Array.from(colorCounts.entries())
    .filter(([color]) => color in COLOR_LABELS)
    .map(([color, count]) => ({ color, count, label: COLOR_LABELS[color]! }))
    .sort((a, b) => b.count - a.count);

  return { total, byColor };
}
