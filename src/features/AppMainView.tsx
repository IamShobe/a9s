import React from "react";
import { Box, Text } from "ink";
import { Table } from "../components/Table/index.js";
import { HelpPanel } from "../components/HelpPanel.js";
import { DetailPanel } from "../components/DetailPanel.js";
import { ErrorStatePanel } from "../components/ErrorStatePanel.js";
import type { HelpTab } from "../components/HelpPanel.js";
import type { HelpPanelState } from "../hooks/useHelpPanel.js";
import type { PickerManager } from "../hooks/usePickerManager.js";
import type { ServiceAdapter } from "../adapters/ServiceAdapter.js";
import type { DetailField } from "../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow } from "../types.js";

interface AppMainViewProps {
  helpPanel: HelpPanelState;
  helpTabs: HelpTab[];
  pickers: PickerManager;
  error: string | null;
  describeState: {
    row: TableRow;
    fields: DetailField[] | null;
    loading: boolean;
  } | null;
  isLoading: boolean;
  filteredRows: TableRow[];
  columns: ColumnDef[];
  selectedIndex: number;
  scrollOffset: number;
  filterText: string;
  adapter: ServiceAdapter;
  termCols: number;
  tableHeight: number;
}

export function AppMainView({
  helpPanel,
  helpTabs,
  pickers,
  error,
  describeState,
  isLoading,
  filteredRows,
  columns,
  selectedIndex,
  scrollOffset,
  filterText,
  adapter,
  termCols,
  tableHeight,
}: AppMainViewProps) {
  if (helpPanel.helpOpen) {
    return (
      <Box width="100%" borderStyle="round" borderColor="blue">
        <HelpPanel
          title="Keyboard Help"
          scopeLabel="All modes reference"
          tabs={helpTabs}
          activeTab={helpPanel.helpTabIndex}
          terminalWidth={termCols}
          maxRows={helpPanel.helpVisibleRows}
          scrollOffset={helpPanel.helpScrollOffset}
        />
      </Box>
    );
  }

  if (pickers.region.open) {
    return (
      <Table
        rows={pickers.region.filteredRows}
        columns={[
          { key: "region", label: "Region" },
          { key: "description", label: "Description" },
        ]}
        selectedIndex={pickers.region.selectedIndex}
        filterText={pickers.region.filter}
        terminalWidth={termCols}
        maxHeight={tableHeight}
        scrollOffset={pickers.region.scrollOffset}
        contextLabel="Select AWS Region"
      />
    );
  }

  if (pickers.profile.open) {
    return (
      <Table
        rows={pickers.profile.filteredRows}
        columns={[
          { key: "profile", label: "Profile" },
          { key: "description", label: "Description" },
        ]}
        selectedIndex={pickers.profile.selectedIndex}
        filterText={pickers.profile.filter}
        terminalWidth={termCols}
        maxHeight={tableHeight}
        scrollOffset={pickers.profile.scrollOffset}
        contextLabel="Select AWS Profile"
      />
    );
  }

  if (pickers.resource.open) {
    return (
      <Table
        rows={pickers.resource.filteredRows}
        columns={[
          { key: "resource", label: "Resource" },
          { key: "description", label: "Description" },
        ]}
        selectedIndex={pickers.resource.selectedIndex}
        filterText={pickers.resource.filter}
        terminalWidth={termCols}
        maxHeight={tableHeight}
        scrollOffset={pickers.resource.scrollOffset}
        contextLabel="Select AWS Resource"
      />
    );
  }

  if (error) {
    return (
      <ErrorStatePanel
        title={`Failed to load ${adapter.label}`}
        message={error}
        hint="Press r to retry"
      />
    );
  }

  if (describeState) {
    return (
      <Box width="100%" borderStyle="round" borderColor="gray">
        <DetailPanel
          title={describeState.row.cells.name ?? describeState.row.id}
          fields={describeState.fields ?? []}
          isLoading={describeState.loading}
        />
      </Box>
    );
  }

  if (isLoading && filteredRows.length === 0) {
    return (
      <Box width="100%" borderStyle="round" borderColor="blue">
        <Box flexDirection="column" paddingX={1}>
          <Text bold color="blue">
            Loading {adapter.label}...
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Table
      rows={filteredRows}
      columns={columns}
      selectedIndex={selectedIndex}
      filterText={filterText}
      terminalWidth={termCols}
      maxHeight={tableHeight}
      scrollOffset={scrollOffset}
      contextLabel={adapter.getContextLabel?.() ?? ""}
    />
  );
}
