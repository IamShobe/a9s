import { useMemo, useLayoutEffect } from "react";
import { SERVICE_REGISTRY } from "../services.js";
import type { ServiceId, AwsServiceId } from "../services.js";
import type { ServiceAdapter, RelatedResource } from "../adapters/ServiceAdapter.js";
import { useServiceView } from "./useServiceView.js";
import { debugLog } from "../utils/debugLogger.js";
import { filterRowsByText } from "../utils/rowUtils.js";
import { applyHeatmapColors } from "../utils/heatmap.js";
import type { AwsRegionOption } from "./useAwsRegions.js";
import type { AwsProfileOption } from "./useAwsProfiles.js";
import { createResourceAdapter } from "../views/_resources/adapter.js";
import { createRegionAdapter } from "../views/_regions/adapter.js";
import { createProfileAdapter } from "../views/_profiles/adapter.js";

interface UseAppDataArgs {
  currentService: ServiceId;
  endpointUrl: string | undefined;
  selectedRegion: string;
  filterText: string;
  availableRegions: AwsRegionOption[];
  availableProfiles: AwsProfileOption[];
  relatedResources?: RelatedResource[];
  tagFilter?: { key: string; value: string } | null;
  sortState?: { colKey: string; dir: "asc" | "desc" } | null;
  heatmapEnabled?: boolean;
  bookmarkedIds?: Set<string>;
}

export function useAppData({
  currentService,
  endpointUrl,
  selectedRegion,
  filterText,
  availableRegions,
  availableProfiles,
  tagFilter,
  sortState,
  heatmapEnabled,
  bookmarkedIds,
}: UseAppDataArgs) {
  const adapter = useMemo<ServiceAdapter>(() => {
    debugLog(currentService, `useAppData: adapter created`);
    switch (currentService) {
      case "_resources":
        return createResourceAdapter();
      case "_regions":
        return createRegionAdapter(availableRegions);
      case "_profiles":
        return createProfileAdapter(availableProfiles);
      default:
        return SERVICE_REGISTRY[currentService as AwsServiceId](endpointUrl, selectedRegion);
    }
  }, [currentService, endpointUrl, selectedRegion, availableRegions, availableProfiles]);

  const { rows, columns, isLoading, error, select, edit, goBack, refresh, path } =
    useServiceView(adapter);

  useLayoutEffect(() => {
    debugLog(adapter.id, `useAppData: received rows from useServiceView`, {
      rowCount: rows.length,
      isLoading,
      "state.adapterId": rows.length > 0 ? "has-data" : "empty",
    });
  }, [rows.length, isLoading, adapter.id]);

  // Tag-filter + sort: only re-runs when rows/tagFilter/sortState change, not on every keystroke.
  const tagSortedRows = useMemo(() => {
    const tagFiltered = tagFilter
      ? rows.filter((row) => {
          const tagVal = row.tags?.[tagFilter.key];
          return tagVal !== undefined && tagVal.toLowerCase().includes(tagFilter.value.toLowerCase());
        })
      : rows;

    const sorted = !sortState
      ? tagFiltered
      : [...tagFiltered].sort((a, b) => {
          const aCell = a.cells[sortState.colKey];
          const bCell = b.cells[sortState.colKey];
          const aVal = typeof aCell === "string" ? aCell : (aCell?.displayName ?? "");
          const bVal = typeof bCell === "string" ? bCell : (bCell?.displayName ?? "");
          const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: "base" });
          return sortState.dir === "asc" ? cmp : -cmp;
        });

    // Float bookmarked rows to top
    if (!bookmarkedIds || bookmarkedIds.size === 0) return sorted;
    const bookmarked = sorted.filter((r) => bookmarkedIds.has(r.id));
    const rest = sorted.filter((r) => !bookmarkedIds.has(r.id));
    return [...bookmarked, ...rest];
  }, [rows, tagFilter, sortState, bookmarkedIds]);

  // Text filter: re-runs on every keystroke but is a cheap O(n) scan.
  const textFilteredRows = useMemo(
    () => filterRowsByText(tagSortedRows, filterText),
    [tagSortedRows, filterText],
  );

  // Heatmap: apply per-cell color to explicitly declared heatmap columns when enabled
  const filteredRows = useMemo(
    () => heatmapEnabled ? applyHeatmapColors(textFilteredRows, columns) : textFilteredRows,
    [textFilteredRows, heatmapEnabled, columns],
  );

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
  };
}
