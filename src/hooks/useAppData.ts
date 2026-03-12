import { useMemo, useLayoutEffect } from "react";
import { SERVICE_REGISTRY } from "../services.js";
import type { ServiceId } from "../services.js";
import type { ServiceAdapter, RelatedResource } from "../adapters/ServiceAdapter.js";
import { useServiceView } from "./useServiceView.js";
import { useNavigation } from "./useNavigation.js";
import { usePickerManager } from "./usePickerManager.js";
import { debugLog } from "../utils/debugLogger.js";
import { filterRowsByText } from "../utils/rowUtils.js";
import type { AwsRegionOption } from "./useAwsRegions.js";
import type { AwsProfileOption } from "./useAwsProfiles.js";

interface UseAppDataArgs {
  currentService: ServiceId;
  endpointUrl: string | undefined;
  selectedRegion: string;
  tableHeight: number;
  filterText: string;
  availableRegions: AwsRegionOption[];
  availableProfiles: AwsProfileOption[];
  relatedResources?: RelatedResource[];
  tagFilter?: { key: string; value: string } | null;
  sortState?: { colKey: string; dir: "asc" | "desc" } | null;
}

export function useAppData({
  currentService,
  endpointUrl,
  selectedRegion,
  tableHeight,
  filterText,
  availableRegions,
  availableProfiles,
  relatedResources,
  tagFilter,
  sortState,
}: UseAppDataArgs) {
  const adapter = useMemo<ServiceAdapter>(() => {
    debugLog(currentService, `useAppData: adapter created`);
    return SERVICE_REGISTRY[currentService](endpointUrl, selectedRegion);
  }, [currentService, endpointUrl, selectedRegion]);

  const { rows, columns, isLoading, error, select, edit, goBack, refresh, path } =
    useServiceView(adapter);

  useLayoutEffect(() => {
    debugLog(adapter.id, `useAppData: received rows from useServiceView`, {
      rowCount: rows.length,
      isLoading,
      "state.adapterId": rows.length > 0 ? "has-data" : "empty",
    });
  }, [rows.length, isLoading, adapter.id]);

  const filteredRows = useMemo(() => {
    const textFiltered = filterRowsByText(rows, filterText);
    const tagFiltered = tagFilter
      ? textFiltered.filter((row) => {
          const tagVal = row.tags?.[tagFilter.key];
          return tagVal !== undefined && tagVal.toLowerCase().includes(tagFilter.value.toLowerCase());
        })
      : textFiltered;

    if (!sortState) return tagFiltered;
    const { colKey, dir } = sortState;
    return [...tagFiltered].sort((a, b) => {
      const aCell = a.cells[colKey];
      const bCell = b.cells[colKey];
      const aVal = typeof aCell === "string" ? aCell : (aCell?.displayName ?? "");
      const bVal = typeof bCell === "string" ? bCell : (bCell?.displayName ?? "");
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: "base" });
      return dir === "asc" ? cmp : -cmp;
    });
  }, [filterText, rows, tagFilter, sortState]);

  const navigation = useNavigation(filteredRows.length, tableHeight);
  const selectedRow = filteredRows[navigation.selectedIndex] ?? null;

  const pickers = usePickerManager({
    tableHeight,
    availableRegions,
    availableProfiles,
    ...(relatedResources !== undefined ? { relatedResources } : {}),
  });

  return {
    adapter,
    rows,
    columns,
    isLoading,
    error,
    select,
    edit,
    goBack,
    refresh,
    path,
    filteredRows,
    selectedRow,
    navigation,
    pickers,
  };
}
