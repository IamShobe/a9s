import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { AppMainView } from "./AppMainView.js";
import type { PickerManager } from "../hooks/usePickerManager.js";
import type { YankOption } from "../adapters/capabilities/YankCapability.js";
import { textCell } from "../types.js";

function createPickerManager(active: PickerManager["activePicker"]): PickerManager {
  const noop = () => {};
  const mkEntry = (id: "region" | "profile" | "resource") => ({
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
    region: mkEntry("region"),
    profile: mkEntry("profile"),
    resource: mkEntry("resource"),
    activePicker: active,
    openPicker: (_id) => {},
    closeActivePicker: noop,
    resetPicker: (_id) => {},
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
    goBack: () => {},
    getPath: () => "s3://",
    getContextLabel: () => "Buckets",
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
      ...createPickerManager(null).resource,
      open: true,
      contextLabel: "Select AWS Resource",
      filteredRows: [
        { id: "s3", cells: { resource: textCell("s3"), description: textCell("S3") } },
      ],
      columns: [
        { key: "resource", label: "Resource" },
        { key: "description", label: "Description" },
      ],
    };

    const { lastFrame } = render(
      <AppMainView {...baseProps} pickers={createPickerManager(activePicker)} />,
    );

    expect(lastFrame()).toContain("Select AWS Resource");
  });

  it("renders details panel when details are present", () => {
    const { lastFrame } = render(
      <AppMainView
        {...baseProps}
        describeState={{
          row: { id: "obj-1", cells: { name: textCell("object-1") } },
          fields: [{ label: "Name", value: "object-1" }],
          loading: false,
        }}
      />,
    );

    expect(lastFrame()).toContain("object-1");
  });

  it("renders yank header markers when provided", () => {
    const { lastFrame } = render(
      <AppMainView {...baseProps} headerMarkers={{ name: ["n", "k"] }} />,
    );

    expect(lastFrame()).toContain("[n,k]");
  });

  it("renders lightweight yank help panel", () => {
    const { lastFrame } = render(
      <AppMainView
        {...baseProps}
        yankHelpOpen={true}
        yankOptions={[
          {
            trigger: { type: "key", char: "n" },
            label: "copy name",
            feedback: "Copied",
            isRelevant: () => true,
            resolve: async () => "x",
          },
        ]}
        yankHelpRow={{ id: "row", cells: { name: textCell("item") } }}
      />,
    );

    expect(lastFrame()).toContain("Yank Options");
    expect(lastFrame()).toContain("copy name");
  });
});
