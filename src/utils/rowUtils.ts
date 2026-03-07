import type { TableRow } from "../types.js";

/** Filter rows by case-insensitive substring match across all cell values. */
export function filterRowsByText(rows: TableRow[], filterText: string): TableRow[] {
  if (!filterText) return rows;
  const lower = filterText.toLowerCase();
  return rows.filter((row) =>
    Object.values(row.cells).some((cell) => {
      const value = typeof cell === "string" ? cell : cell.displayName;
      return value.toLowerCase().includes(lower);
    }),
  );
}
