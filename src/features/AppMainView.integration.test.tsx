import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { AppMainView } from "./AppMainView.js";
import type { PickerManager } from "../hooks/usePickerManager.js";
import type { YankOption } from "../adapters/capabilities/YankCapability.js";
import { textCell } from "../types.js";

function createPickerManager(active: PickerManager["activePicker"]): PickerManager {
  const noop = () => {};
  const mkEntry = (id: "theme" | "related" | "bookmarks") => ({
    id,
    columns: [{ key: id, label: id }],
    contextLabel: id,
    open: false,
    filter: "",
    searchEntry: null,
    pickerMode: "navigate" as const,
    setFilter: noop,
    openPicker: noop,
    closePicker: noop,
    startSearch: noop,
    cancelSearch: noop,
    confirmSearch: noop,
    filteredRows: [],
    selectedRow: null,
    selectedIndex: 0,
    scrollOffset: 0,
    moveUp: noop,
    moveDown: noop,
    reset: noop,
    toTop: noop,
    toBottom: noop,
  });

  return {
    theme: mkEntry("theme"),
    related: mkEntry("related"),
    bookmarks: mkEntry("bookmarks"),
    activePicker: active,
    openPicker: (_id) => {},
    closeActivePicker: noop,
    resetPicker: (_id) => {},
    refreshPicker: noop,
    confirmActivePickerSelection: (_handlers) => {},
  };
}

const baseProps = {
  helpPanel: {
    helpOpen: false,
    helpTabIndex: 0,
    helpScrollOffset: 0,
    helpVisibleRows: 10,
    open: () => {},
    openAtTab: () => {},
    close: () => {},
    scrollUp: () => {},
    scrollDown: () => {},
    goToPrevTab: () => {},
    goToNextTab: () => {},
    goToTab: () => true,
  },
  helpTabs: [{ title: "General", items: [{ key: "q", description: "quit" }] }],
  pickers: createPickerManager(null),
  error: null,
  describeState: null,
  isLoading: false,
  filteredRows: [{ id: "r1", cells: { name: textCell("row1") } }],
  columns: [{ key: "name", label: "Name" }],
  selectedIndex: 0,
  scrollOffset: 0,
  filterText: "",
  adapter: {
    id: "s3",
    label: "S3",
    hudColor: { bg: "blue", fg: "white" },
    getColumns: () => [{ key: "name", label: "Name" }],
    getRows: async () => [],
    onSelect: async () => ({ action: "none" as const }),
    canGoBack: () => false,
    goBack: () => undefined,
    pushUiLevel: () => {},
    getPath: () => "s3://",
    getContextLabel: () => "Buckets",
    getBookmarkKey: (row: { id: string }) => [{ label: "Item", displayName: row.id, id: row.id }],
  },
  termCols: 120,
  tableHeight: 20,
  yankHelpOpen: false,
  yankOptions: [] as YankOption[],
  yankHelpRow: null,
  panelScrollOffset: 0,
};

describe("AppMainView integration", () => {
  it("prioritizes help panel when open", () => {
    const { lastFrame } = render(
      <AppMainView {...baseProps} helpPanel={{ ...baseProps.helpPanel, helpOpen: true }} />,
    );

    expect(lastFrame()).toContain("Keyboard Help");
  });

  it("renders picker table when picker is active", () => {
    const activePicker = {
      ...createPickerManager(null).theme,
      id: "theme" as const,
      open: true,
      contextLabel: "Select Theme",
      filteredRows: [
        { id: "monokai", cells: { theme: textCell("Monokai"), id: textCell("monokai") } },
      ],
      columns: [
        { key: "theme", label: "Theme" },
        { key: "id", label: "ID" },
      ],
    };

    const { lastFrame } = render(
      <AppMainView {...baseProps} pickers={createPickerManager(activePicker)} />,
    );

    expect(lastFrame()).toContain("Select Theme");
  });
});
