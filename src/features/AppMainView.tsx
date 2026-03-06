import React, { useLayoutEffect } from "react";
import { Box, Text } from "ink";
import { Table } from "../components/Table/index.js";
import { HelpPanel } from "../components/HelpPanel.js";
import { YankHelpPanel } from "../components/YankHelpPanel.js";
import { DetailPanel } from "../components/DetailPanel.js";
import { ErrorStatePanel } from "../components/ErrorStatePanel.js";
import { TableSkeleton } from "../components/TableSkeleton.js";
import { debugLog } from "../utils/debugLogger.js";
import type { HelpTab } from "../components/HelpPanel.js";
import type { HelpPanelState } from "../hooks/useHelpPanel.js";
import type { PickerManager } from "../hooks/usePickerManager.js";
import type { ServiceAdapter } from "../adapters/ServiceAdapter.js";
import type { DetailField } from "../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow } from "../types.js";
import type { YankOption } from "../adapters/capabilities/YankCapability.js";

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
  headerMarkers?: Record<string, string[]>;
  yankHelpOpen: boolean;
  yankOptions: YankOption[];
  yankHelpRow: TableRow | null;
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
  headerMarkers,
  yankHelpOpen,
  yankOptions,
  yankHelpRow,
}: AppMainViewProps) {
  useLayoutEffect(() => {
    debugLog(adapter.id, `AppMainView render`, {
      isLoading,
      filteredRowsCount: filteredRows.length,
      columnsCount: columns.length,
      isHelp: helpPanel.helpOpen,
      hasDescribe: !!describeState,
      hasPicker: !!pickers.activePicker,
      hasYankHelp: yankHelpOpen,
      hasError: !!error,
    });
  }, [
    adapter.id,
    isLoading,
    filteredRows.length,
    columns.length,
    helpPanel.helpOpen,
    describeState,
    pickers.activePicker,
    yankHelpOpen,
    error,
  ]);

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

  if (pickers.activePicker) {
    const ap = pickers.activePicker;
    return (
      <Table
        rows={ap.filteredRows}
        columns={ap.columns}
        selectedIndex={ap.selectedIndex}
        filterText={ap.filter}
        terminalWidth={termCols}
        maxHeight={tableHeight}
        scrollOffset={ap.scrollOffset}
        contextLabel={ap.contextLabel}
      />
    );
  }

  if (yankHelpOpen) {
    return (
      <Box width="100%" borderStyle="round" borderColor="cyan">
        <YankHelpPanel options={yankOptions} row={yankHelpRow} />
      </Box>
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

  if (isLoading) {
    return (
      <TableSkeleton
        columns={columns}
        terminalWidth={termCols}
        rows={1}
        contextLabel={adapter.getContextLabel?.() ?? ""}
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
      {...(headerMarkers ? { headerMarkers } : {})}
    />
  );
}
