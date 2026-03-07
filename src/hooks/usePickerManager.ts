import { useMemo } from "react";
import type { AwsRegionOption } from "./useAwsRegions.js";
import type { AwsProfileOption } from "./useAwsProfiles.js";
import type { ColumnDef, TableRow } from "../types.js";
import { textCell } from "../types.js";
import { usePickerState } from "./usePickerState.js";
import { usePickerTable } from "./usePickerTable.js";
import { SERVICE_REGISTRY } from "../services.js";
import type { ServiceId } from "../services.js";
import { THEMES, THEME_LABELS } from "../constants/theme.js";
import type { ThemeName } from "../constants/theme.js";

export interface PickerEntry {
  // Picker identity
  id: "region" | "profile" | "resource" | "theme";
  columns: ColumnDef[];
  contextLabel: string;
  // Picker open/filter/search state
  open: boolean;
  filter: string;
  searchEntry: string | null;
  pickerMode: "navigate" | "search";
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
  theme: PickerEntry;
  activePicker: PickerEntry | null;
  openPicker: (id: PickerEntry["id"]) => void;
  closeActivePicker: () => void;
  resetPicker: (id: PickerEntry["id"]) => void;
  confirmActivePickerSelection: (handlers: {
    onSelectResource: (resourceId: ServiceId) => void;
    onSelectRegion: (region: string) => void;
    onSelectProfile: (profile: string) => void;
    onSelectTheme: (themeName: ThemeName) => void;
  }) => void;
}

export function usePickerManager({
  tableHeight,
  availableRegions,
  availableProfiles,
}: UsePickerManagerArgs): PickerManager {
  const region = usePickerState();
  const profile = usePickerState();
  const resource = usePickerState();
  const theme = usePickerState();

  const regionRows = useMemo<TableRow[]>(
    () =>
      availableRegions.map((r) => ({
        id: r.name,
        cells: { region: textCell(r.name), description: textCell(r.description) },
        meta: {},
      })),
    [availableRegions],
  );

  const profileRows = useMemo<TableRow[]>(
    () =>
      availableProfiles.map((p) => ({
        id: p.name,
        cells: { profile: textCell(p.name), description: textCell(p.description) },
        meta: {},
      })),
    [availableProfiles],
  );

  const resourceRows = useMemo<TableRow[]>(
    () =>
      (Object.keys(SERVICE_REGISTRY) as ServiceId[]).map((serviceId) => ({
        id: serviceId,
        cells: {
          resource: textCell(serviceId),
          description: textCell(`${serviceId.toUpperCase()} service`),
        },
        meta: {},
      })),
    [],
  );

  const themeRows = useMemo<TableRow[]>(
    () =>
      (Object.keys(THEMES) as ThemeName[]).map((themeName) => ({
        id: themeName,
        cells: {
          theme: textCell(THEME_LABELS[themeName]),
          id: textCell(themeName),
        },
        meta: {},
      })),
    [],
  );

  const regionTable = usePickerTable({
    rows: regionRows,
    filterText: region.filter,
    maxHeight: tableHeight,
  });
  const profileTable = usePickerTable({
    rows: profileRows,
    filterText: profile.filter,
    maxHeight: tableHeight,
  });
  const resourceTable = usePickerTable({
    rows: resourceRows,
    filterText: resource.filter,
    maxHeight: tableHeight,
  });
  const themeTable = usePickerTable({
    rows: themeRows,
    filterText: theme.filter,
    maxHeight: tableHeight,
  });

  const regionColumns: ColumnDef[] = [
    { key: "region", label: "Region" },
    { key: "description", label: "Description" },
  ];

  const profileColumns: ColumnDef[] = [
    { key: "profile", label: "Profile" },
    { key: "description", label: "Description" },
  ];

  const resourceColumns: ColumnDef[] = [
    { key: "resource", label: "Resource" },
    { key: "description", label: "Description" },
  ];

  const themeColumns: ColumnDef[] = [
    { key: "theme", label: "Theme" },
    { key: "id", label: "ID" },
  ];

  const regionEntry: PickerEntry = {
    id: "region",
    columns: regionColumns,
    contextLabel: "Select AWS Region",
    ...region,
    ...regionTable,
  };

  const profileEntry: PickerEntry = {
    id: "profile",
    columns: profileColumns,
    contextLabel: "Select AWS Profile",
    ...profile,
    ...profileTable,
  };

  const resourceEntry: PickerEntry = {
    id: "resource",
    columns: resourceColumns,
    contextLabel: "Select AWS Resource",
    ...resource,
    ...resourceTable,
  };

  const themeEntry: PickerEntry = {
    id: "theme",
    columns: themeColumns,
    contextLabel: "Select Theme",
    ...theme,
    ...themeTable,
  };

  const activePicker =
    [regionEntry, profileEntry, resourceEntry, themeEntry].find((e) => e.open) ?? null;

  const getEntry = (id: PickerEntry["id"]): PickerEntry => {
    switch (id) {
      case "region":
        return regionEntry;
      case "profile":
        return profileEntry;
      case "resource":
        return resourceEntry;
      case "theme":
        return themeEntry;
    }
  };

  const openPicker = (id: PickerEntry["id"]) => {
    const entry = getEntry(id);
    entry.openPicker();
    entry.reset();
  };

  const closeActivePicker = () => {
    activePicker?.closePicker();
  };

  const resetPicker = (id: PickerEntry["id"]) => {
    getEntry(id).reset();
  };

  const confirmActivePickerSelection: PickerManager["confirmActivePickerSelection"] = (
    handlers,
  ) => {
    if (!activePicker?.selectedRow) return;

    switch (activePicker.id) {
      case "resource":
        handlers.onSelectResource(activePicker.selectedRow.id as ServiceId);
        break;
      case "region":
        handlers.onSelectRegion(activePicker.selectedRow.id);
        break;
      case "profile":
        handlers.onSelectProfile(activePicker.selectedRow.id);
        break;
      case "theme":
        handlers.onSelectTheme(activePicker.selectedRow.id as ThemeName);
        break;
    }
    activePicker.closePicker();
  };

  return {
    region: regionEntry,
    profile: profileEntry,
    resource: resourceEntry,
    theme: themeEntry,
    activePicker,
    openPicker,
    closeActivePicker,
    resetPicker,
    confirmActivePickerSelection,
  };
}
