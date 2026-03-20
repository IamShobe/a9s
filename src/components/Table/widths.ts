import type { ColumnDef } from "../../types.js";

export function computeColumnWidths(columns: ColumnDef[], terminalWidth: number): number[] {
  const MIN_WIDTH = 4;
  const GAP = 3; // " │ " between columns (space-bar-space = 3 chars)

  const totalGaps = (columns.length - 1) * GAP;
  const available = Math.max(0, terminalWidth - totalGaps);

  // Separate fixed vs flex columns
  const fixedIndices: number[] = [];
  const flexIndices: number[] = [];
  const widths: number[] = new Array(columns.length);

  for (let i = 0; i < columns.length; i++) {
    if (columns[i]!.width !== undefined) {
      fixedIndices.push(i);
      widths[i] = columns[i]!.width!;
    } else {
      flexIndices.push(i);
    }
  }

  const fixedTotal = fixedIndices.reduce((sum, i) => sum + widths[i]!, 0);
  const flexCount = flexIndices.length;

  const flexMinTotal = flexCount * MIN_WIDTH;

  if (fixedTotal + flexMinTotal <= available) {
    // Happy path: fixed columns + flex minimums fit — flex columns split the remainder
    const flexAvailable = available - fixedTotal;
    const flexWidth = flexCount > 0 ? Math.floor(flexAvailable / flexCount) : 0;
    for (const i of flexIndices) {
      widths[i] = Math.max(flexWidth, MIN_WIDTH);
    }
  } else {
    // Overflow path: fixed columns exceed available space — shrink proportionally
    // Give flex columns MIN_WIDTH, then shrink fixed to fill the rest
    const flexBudget = flexCount * MIN_WIDTH;
    const fixedBudget = Math.max(0, available - flexBudget);

    for (const i of flexIndices) {
      widths[i] = MIN_WIDTH;
    }

    if (fixedBudget <= 0 || fixedTotal === 0) {
      // No room for fixed columns at all
      for (const i of fixedIndices) {
        widths[i] = Math.max(columns[i]!.minWidth ?? MIN_WIDTH, MIN_WIDTH);
      }
    } else {
      // Shrink each fixed column proportionally
      let allocated = 0;
      const minWidths: number[] = [];
      for (const i of fixedIndices) {
        const minW = Math.max(columns[i]!.minWidth ?? MIN_WIDTH, MIN_WIDTH);
        minWidths.push(minW);
        const proportional = Math.floor((widths[i]! / fixedTotal) * fixedBudget);
        widths[i] = Math.max(proportional, minW);
        allocated += widths[i]!;
      }

      // Distribute rounding remainder to widest columns first
      let remainder = fixedBudget - allocated;
      if (remainder > 0) {
        // Sort indices by current width descending for remainder distribution
        const sorted = [...fixedIndices].sort((a, b) => widths[b]! - widths[a]!);
        for (const i of sorted) {
          if (remainder <= 0) break;
          widths[i]!++;
          remainder--;
        }
      }
    }
  }

  return widths;
}
