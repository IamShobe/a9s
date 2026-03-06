import { useMemo, useLayoutEffect } from "react";
import { SERVICE_REGISTRY } from "../services.js";
import type { ServiceId } from "../services.js";
import type { ServiceAdapter } from "../adapters/ServiceAdapter.js";
import { useServiceView } from "./useServiceView.js";
import { useNavigation } from "./useNavigation.js";
import { usePickerManager } from "./usePickerManager.js";
import { debugLog } from "../utils/debugLogger.js";
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
}

export function useAppData({
  currentService,
  endpointUrl,
  selectedRegion,
  tableHeight,
  filterText,
  availableRegions,
  availableProfiles,
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
    if (!filterText) return rows;
    const lowerFilter = filterText.toLowerCase();
    return rows.filter((row) =>
      Object.values(row.cells).some((cell) => {
        const value = typeof cell === "string" ? cell : cell.displayName;
        return value.toLowerCase().includes(lowerFilter);
      }),
    );
  }, [filterText, rows]);

  const navigation = useNavigation(filteredRows.length, tableHeight);
  const selectedRow = filteredRows[navigation.selectedIndex] ?? null;

  const pickers = usePickerManager({ tableHeight, availableRegions, availableProfiles });

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
