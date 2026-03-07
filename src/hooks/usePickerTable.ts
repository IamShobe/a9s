import { useMemo } from "react";
import type { TableRow } from "../types.js";
import { useNavigation } from "./useNavigation.js";
import { filterRowsByText } from "../utils/rowUtils.js";

interface UsePickerTableArgs {
  rows: TableRow[];
  filterText: string;
  maxHeight: number;
}

export function usePickerTable({ rows, filterText, maxHeight }: UsePickerTableArgs) {
  const filteredRows = useMemo(() => filterRowsByText(rows, filterText), [filterText, rows]);

  const nav = useNavigation(filteredRows.length, maxHeight);
  const selectedRow = filteredRows[nav.selectedIndex] ?? null;

  return {
    filteredRows,
    selectedRow,
    ...nav,
  };
}
