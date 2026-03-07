import { useState, useCallback } from "react";

export interface PickerState {
  open: boolean;
  filter: string;
  searchEntry: string | null;
  pickerMode: "navigate" | "search";
  setFilter: (v: string) => void;
  /** Open picker with fresh state */
  openPicker: () => void;
  /** Close picker and reset all state */
  closePicker: () => void;
  /** Save current filter before entering search sub-mode */
  startSearch: () => void;
  /** Restore filter to saved entry point (Esc in search sub-mode) */
  cancelSearch: () => void;
  /** Clear saved entry (Enter/confirm in search sub-mode) */
  confirmSearch: () => void;
}

export function usePickerState(): PickerState {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [searchEntry, setSearchEntry] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<"navigate" | "search">("navigate");

  const openPicker = useCallback(() => {
    setOpen(true);
    setFilter("");
    setSearchEntry(null);
    setPickerMode("navigate");
  }, []);

  const closePicker = useCallback(() => {
    setOpen(false);
    setFilter("");
    setSearchEntry(null);
    setPickerMode("navigate");
  }, []);

  const startSearch = useCallback(() => {
    setSearchEntry((prev) => prev ?? filter);
    setPickerMode("search");
  }, [filter]);

  const cancelSearch = useCallback(() => {
    setFilter(searchEntry !== null ? searchEntry : "");
    setSearchEntry(null);
    setPickerMode("navigate");
  }, [searchEntry]);

  const confirmSearch = useCallback(() => {
    setSearchEntry(null);
    setPickerMode("navigate");
  }, []);

  return {
    open,
    filter,
    searchEntry,
    pickerMode,
    setFilter,
    openPicker,
    closePicker,
    startSearch,
    cancelSearch,
    confirmSearch,
  };
}
