import { useMemo } from "react";
import type { AwsRegionOption } from "./useAwsRegions.js";
import type { AwsProfileOption } from "./useAwsProfiles.js";
import type { TableRow } from "../types.js";
import { usePickerState } from "./usePickerState.js";
import { usePickerTable } from "./usePickerTable.js";
import { SERVICE_REGISTRY } from "../services.js";
import type { ServiceId } from "../services.js";

export interface PickerEntry {
  // Picker open/filter/search state
  open: boolean;
  filter: string;
  searchEntry: string | null;
  setFilter: (v: string) => void;
  openPicker: () => void;
  closePicker: () => void;
  startSearch: () => void;
  cancelSearch: () => void;
  confirmSearch: () => void;
  // Table state
  filteredRows: TableRow[];
  selectedRow: TableRow | null;
  selectedIndex: number;
  scrollOffset: number;
  moveUp: () => void;
  moveDown: () => void;
  reset: () => void;
  toTop: () => void;
  toBottom: () => void;
}

interface UsePickerManagerArgs {
  tableHeight: number;
  availableRegions: AwsRegionOption[];
  availableProfiles: AwsProfileOption[];
}

export interface PickerManager {
  region: PickerEntry;
  profile: PickerEntry;
  resource: PickerEntry;
}

export function usePickerManager({
  tableHeight,
  availableRegions,
  availableProfiles,
}: UsePickerManagerArgs): PickerManager {
  const region   = usePickerState();
  const profile  = usePickerState();
  const resource = usePickerState();

  const regionRows = useMemo<TableRow[]>(
    () =>
      availableRegions.map((r) => ({
        id: r.name,
        cells: { region: r.name, description: r.description },
        meta: {},
      })),
    [availableRegions],
  );

  const profileRows = useMemo<TableRow[]>(
    () =>
      availableProfiles.map((p) => ({
        id: p.name,
        cells: { profile: p.name, description: p.description },
        meta: {},
      })),
    [availableProfiles],
  );

  const resourceRows = useMemo<TableRow[]>(
    () =>
      (Object.keys(SERVICE_REGISTRY) as ServiceId[]).map((serviceId) => ({
        id: serviceId,
        cells: { resource: serviceId, description: `${serviceId.toUpperCase()} service` },
        meta: {},
      })),
    [],
  );

  const regionTable   = usePickerTable({ rows: regionRows,   filterText: region.filter,   maxHeight: tableHeight });
  const profileTable  = usePickerTable({ rows: profileRows,  filterText: profile.filter,  maxHeight: tableHeight });
  const resourceTable = usePickerTable({ rows: resourceRows, filterText: resource.filter, maxHeight: tableHeight });

  return {
    region:   { ...region,   ...regionTable },
    profile:  { ...profile,  ...profileTable },
    resource: { ...resource, ...resourceTable },
  };
}
