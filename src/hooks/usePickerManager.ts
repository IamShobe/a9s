import { useMemo, useState, useCallback } from "react";
import type { ColumnDef, TableRow } from "../types.js";
import { textCell } from "../types.js";
import { usePickerState } from "./usePickerState.js";
import { usePickerTable } from "./usePickerTable.js";
import { THEMES, THEME_LABELS } from "../constants/theme.js";
import type { ThemeName } from "../constants/theme.js";
import type { ServiceId } from "../services.js";
import type { RelatedResource } from "../adapters/ServiceAdapter.js";
import { loadBookmarks, getBookmarkDisplayName } from "../utils/bookmarks.js";
import type { BookmarkEntry } from "../utils/bookmarks.js";

export interface PickerEntry {
  // Picker identity
  id: "theme" | "related" | "bookmarks";
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
  relatedResources?: RelatedResource[];
}

export interface PickerManager {
  theme: PickerEntry;
  related: PickerEntry;
  bookmarks: PickerEntry;
  activePicker: PickerEntry | null;
  openPicker: (id: PickerEntry["id"]) => void;
  closeActivePicker: () => void;
  resetPicker: (id: PickerEntry["id"]) => void;
  refreshPicker: (id: PickerEntry["id"]) => void;
  confirmActivePickerSelection: (handlers: {
    onSelectTheme: (themeName: ThemeName) => void;
    onSelectRelated: (serviceId: ServiceId, filterHint?: string) => void;
    onSelectBookmark?: (entry: BookmarkEntry) => void;
  }) => void;
}

export function usePickerManager({
  tableHeight,
  relatedResources = [],
}: UsePickerManagerArgs): PickerManager {
  const theme = usePickerState();
  const related = usePickerState();
  const bookmarksPicker = usePickerState();
  const [bookmarksRefreshToken, setBookmarksRefreshToken] = useState(0);

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

  const relatedRows = useMemo<TableRow[]>(
    () =>
      relatedResources.map((r) => ({
        id: r.serviceId,
        cells: {
          service: textCell(r.label),
          ...(r.filterHint ? { hint: textCell(r.filterHint) } : {}),
        },
        meta: { filterHint: r.filterHint },
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [relatedResources],
  );

  const bookmarksRows = useMemo<TableRow[]>(() => {
    return loadBookmarks().map((entry) => ({
      id: `${entry.serviceId}::${entry.rowId}`,
      cells: {
        label: textCell(getBookmarkDisplayName(entry)),
        service: textCell(entry.serviceId),
        savedAt: textCell(entry.savedAt.slice(0, 10)),
      },
      meta: { bookmarkEntry: entry },
    }));
  }, [bookmarksPicker.open, bookmarksRefreshToken]);

  const themeTable = usePickerTable({
    rows: themeRows,
    filterText: theme.filter,
    maxHeight: tableHeight,
  });

  const relatedTable = usePickerTable({
    rows: relatedRows,
    filterText: related.filter,
    maxHeight: tableHeight,
  });

  const bookmarksTable = usePickerTable({
    rows: bookmarksRows,
    filterText: bookmarksPicker.filter,
    maxHeight: tableHeight,
  });

  const themeColumns: ColumnDef[] = [
    { key: "theme", label: "Theme" },
    { key: "id", label: "ID" },
  ];

  const relatedColumns: ColumnDef[] = [
    { key: "service", label: "Jump To" },
    { key: "hint", label: "Filter" },
  ];

  const bookmarksColumns: ColumnDef[] = [
    { key: "label", label: "Label" },
    { key: "service", label: "Service", width: 20 },
    { key: "savedAt", label: "Saved", width: 12 },
  ];

  const themeEntry: PickerEntry = {
    id: "theme",
    columns: themeColumns,
    contextLabel: "Select Theme",
    ...theme,
    ...themeTable,
  };

  const relatedEntry: PickerEntry = {
    id: "related",
    columns: relatedColumns,
    contextLabel: "Jump to Related Resource",
    ...related,
    ...relatedTable,
  };

  const bookmarksEntry: PickerEntry = {
    id: "bookmarks",
    columns: bookmarksColumns,
    contextLabel: "Bookmarks",
    ...bookmarksPicker,
    ...bookmarksTable,
  };

  const activePicker =
    [themeEntry, relatedEntry, bookmarksEntry].find((e) => e.open) ??
    null;

  const getEntry = (id: PickerEntry["id"]): PickerEntry => {
    switch (id) {
      case "theme":
        return themeEntry;
      case "related":
        return relatedEntry;
      case "bookmarks":
        return bookmarksEntry;
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
      case "theme":
        handlers.onSelectTheme(activePicker.selectedRow.id as ThemeName);
        break;
      case "related": {
        const filterHint = activePicker.selectedRow.meta?.filterHint as string | undefined;
        handlers.onSelectRelated(activePicker.selectedRow.id as ServiceId, filterHint);
        break;
      }
      case "bookmarks": {
        const entry = activePicker.selectedRow.meta?.bookmarkEntry as BookmarkEntry | undefined;
        if (entry && handlers.onSelectBookmark) {
          handlers.onSelectBookmark(entry);
        }
        break;
      }
    }
    activePicker.closePicker();
  };

  return {
    theme: themeEntry,
    related: relatedEntry,
    bookmarks: bookmarksEntry,
    activePicker,
    openPicker,
    closeActivePicker,
    resetPicker,
    refreshPicker: (id: PickerEntry["id"]) => {
      if (id === "bookmarks") setBookmarksRefreshToken((n) => n + 1);
    },
    confirmActivePickerSelection,
  };
}
