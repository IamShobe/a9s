import type { ColumnDef } from "../../types.js";

export function computeColumnWidths(columns: ColumnDef[], terminalWidth: number): number[] {
  const MIN_WIDTH = 4;
  const GAP = 3; // " │ " between columns (space-bar-space = 3 chars)

  const totalGaps = (columns.length - 1) * GAP;
  const available = Math.max(0, terminalWidth - totalGaps);

  // Assign fixed widths first
  let fixedTotal = 0;
  const widths: (number | null)[] = columns.map((col) => {
    if (col.width !== undefined) {
      fixedTotal += col.width;
      return col.width;
    }
    return null;
  });

  const flexColumns = widths.filter((w) => w === null).length;
  const flexAvailable = Math.max(available - fixedTotal, flexColumns * MIN_WIDTH);
  const flexWidth = flexColumns > 0 ? Math.floor(flexAvailable / flexColumns) : 0;

  return widths.map((w) => (w !== null ? w : Math.max(flexWidth, MIN_WIDTH)));
}
