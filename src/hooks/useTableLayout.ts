import { useMemo } from "react";
import type { TableRow } from "../types.js";
import type { ServiceAdapter, RelatedResource } from "../adapters/ServiceAdapter.js";
import { useNavigation } from "./useNavigation.js";
import { usePickerManager } from "./usePickerManager.js";
import { computeTableDataRows, computeSearchHistoryLines } from "../utils/layoutBudget.js";
import { summarizeRowStatuses } from "../utils/rowUtils.js";

interface UseTableLayoutArgs {
  contentBudget: number;
  adapter: ServiceAdapter;
  filteredRows: TableRow[];
  showSearchHistory: boolean;
  searchHistoryLength: number;
  relatedResources: RelatedResource[];
}

export function useTableLayout({
  contentBudget,
  adapter,
  filteredRows,
  showSearchHistory,
  searchHistoryLength,
  relatedResources,
}: UseTableLayoutArgs) {
  const hasContextLabel = Boolean(adapter.getContextLabel?.());
  const statusSummary = useMemo(() => summarizeRowStatuses(filteredRows), [filteredRows]);
  const hasStatusRow = statusSummary.byColor.length > 0;
  // Only reserve for status row (deterministic). Preview row is rare (only when columns
  // are truncated) and the 1-line cost of not reserving is absorbed by flex layout.
  const footerContentRows = hasStatusRow ? 1 : 0;
  const searchHistoryLines = computeSearchHistoryLines(showSearchHistory, searchHistoryLength);

  const dataRows = computeTableDataRows(contentBudget - searchHistoryLines, {
    hasContextLabel,
    footerContentRows,
    totalRows: filteredRows.length,
  });

  const navigation = useNavigation(filteredRows.length, dataRows);
  const selectedRow = filteredRows[navigation.selectedIndex] ?? null;
  const pickers = usePickerManager({
    tableHeight: dataRows,
    ...(relatedResources.length > 0 ? { relatedResources } : {}),
  });

  return {
    dataRows,
    navigation,
    selectedRow,
    pickers,
    statusSummary,
  };
}
