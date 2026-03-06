import { useMemo } from "react";
import type { TableRow } from "../types.js";
import { useNavigation } from "./useNavigation.js";

interface UsePickerTableArgs {
  rows: TableRow[];
  filterText: string;
  maxHeight: number;
}

export function usePickerTable({ rows, filterText, maxHeight }: UsePickerTableArgs) {
  const filteredRows = useMemo(() => {
    if (!filterText) return rows;
    const lower = filterText.toLowerCase();
    return rows.filter((row) =>
      Object.values(row.cells).some((cell) => {
        const value = typeof cell === 'string' ? cell : cell.displayName;
        return value.toLowerCase().includes(lower);
      }),
    );
  }, [filterText, rows]);

  const nav = useNavigation(filteredRows.length, maxHeight);
  const selectedRow = filteredRows[nav.selectedIndex] ?? null;

  return {
    filteredRows,
    selectedRow,
    ...nav,
  };
}

