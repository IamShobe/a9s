import { useState, useCallback } from "react";

export interface PickerState {
  open: boolean;
  filter: string;
  searchEntry: string | null;
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

  const openPicker = useCallback(() => {
    setOpen(true);
    setFilter("");
    setSearchEntry(null);
  }, []);

  const closePicker = useCallback(() => {
    setOpen(false);
    setFilter("");
    setSearchEntry(null);
  }, []);

  const startSearch = useCallback(() => {
    setSearchEntry((prev) => prev ?? filter);
  }, [filter]);

  const cancelSearch = useCallback(() => {
    setFilter((current) => {
      const restored = searchEntry !== null && current !== "" ? searchEntry : current;
      setSearchEntry(null);
      return restored;
    });
  }, [searchEntry]);

  const confirmSearch = useCallback(() => {
    setSearchEntry(null);
  }, []);

  return {
    open,
    filter,
    searchEntry,
    setFilter,
    openPicker,
    closePicker,
    startSearch,
    cancelSearch,
    confirmSearch,
  };
}
