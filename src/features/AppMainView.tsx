import React, { useLayoutEffect, useMemo } from "react";
import { Box, Text } from "ink";
import { useAtomValue } from "jotai";
import { Table } from "../components/Table/index.js";
import { HelpPanel } from "../components/HelpPanel.js";
import { YankHelpPanel } from "../components/YankHelpPanel.js";
import { DetailPanel } from "../components/DetailPanel.js";
import { ErrorStatePanel } from "../components/ErrorStatePanel.js";
import { TableSkeleton } from "../components/TableSkeleton.js";
import { DiffViewer } from "../components/DiffViewer.js";
import { SearchHistoryDropdown } from "../components/SearchHistoryDropdown.js";
import { HistogramPanel } from "../components/HistogramPanel.js";
import { FilePreviewPanel } from "../components/FilePreviewPanel.js";
import { debugLog } from "../utils/debugLogger.js";
import { revealSecretsAtom } from "../state/atoms.js";
import { truncateSecretForTable } from "../utils/secretDisplay.js";
import type { HelpTab } from "../components/HelpPanel.js";
import type { HelpPanelState } from "../hooks/useHelpPanel.js";
import type { PickerManager } from "../hooks/usePickerManager.js";
import type { ServiceAdapter } from "../adapters/ServiceAdapter.js";
import type { DetailField } from "../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow } from "../types.js";
import { getCellLabel } from "../types.js";
import type { YankOption } from "../adapters/capabilities/YankCapability.js";
import { useTheme } from "../contexts/ThemeContext.js";
import type { HistogramBar } from "../utils/histogram.js";
import type { FilePreviewState } from "../hooks/useFilePreview.js";
import type { useNavigation } from "../hooks/useNavigation.js";

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
  sortState?: { colKey: string; dir: "asc" | "desc" } | null;
  yankHelpOpen: boolean;
  yankOptions: YankOption[];
  yankHelpRow: TableRow | null;
  uploadPending?: { filePath: string; metadata: Record<string, unknown> } | null;
  uploadPreview?: { old: string; new: string };
  panelScrollOffset: number;
  footerContent?: React.ReactNode;
  selectedRowIds?: Set<string>;
  bookmarkedIds?: Set<string>;
  searchHistory?: string[];
  searchHistoryIndex?: number;
  showSearchHistory?: boolean;
  histogramState?: { columnKey: string; columnLabel: string; bars: HistogramBar[] | null } | null;
  filePreviewState?: FilePreviewState | null;
  filePreviewNavigation?: ReturnType<typeof useNavigation>;
  onPreviewFilterChange?: (text: string) => void;
  onPreviewFilterSubmit?: () => void;
}

export function AppMainView({
  helpPanel,
  helpTabs,
  pickers,
  error,
  describeState,
  isLoading,
  filteredRows,
  uploadPending,
  uploadPreview,
  columns,
  selectedIndex,
  scrollOffset,
  filterText,
  adapter,
  termCols,
  tableHeight,
  headerMarkers,
  sortState,
  yankHelpOpen,
  yankOptions,
  yankHelpRow,
  panelScrollOffset,
  footerContent,
  selectedRowIds,
  bookmarkedIds,
  searchHistory,
  searchHistoryIndex,
  showSearchHistory,
  histogramState,
  filePreviewState,
  filePreviewNavigation,
  onPreviewFilterChange,
  onPreviewFilterSubmit,
}: AppMainViewProps) {
  const theme = useTheme();
  const revealSecrets = useAtomValue(revealSecretsAtom);

  // Format secret values for display ONLY - original rows (via filteredRows) stay unchanged for editing
  const displayRows = useMemo(() => {
    return filteredRows.map((row) => {
      const hasSecrets = Object.values(row.cells).some((cell) => {
        return typeof cell === "object" && cell?.type === "secret";
      });

      if (!hasSecrets) {
        return row;
      }

      // Format secret cells for display
      return {
        ...row,
        cells: Object.fromEntries(
          Object.entries(row.cells).map(([key, cell]) => {
            if (typeof cell === "object" && cell?.type === "secret") {
              return [
                key,
                {
                  ...cell,
                  displayName: truncateSecretForTable(cell.displayName, revealSecrets, 50),
                },
              ];
            }
            return [key, cell];
          }),
        ),
      };
    });
  }, [filteredRows, revealSecrets]);
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
      <Box width="100%" borderStyle="round" borderColor={theme.panel.helpPanelBorderText} backgroundColor={theme.global.mainBg}>
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
    // Pickers don't show secrets, use unformatted rows
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
      <Box width="100%" borderStyle="round" borderColor={theme.panel.yankPanelBorderText} backgroundColor={theme.global.mainBg}>
        <YankHelpPanel options={yankOptions} row={yankHelpRow} />
      </Box>
    );
  }

  if (uploadPending) {
    // Overhead: border 2 + header 4 + separators 2 + DiffViewer header+divider 2 = 10
    const diffVisibleLines = Math.max(1, tableHeight - 10);
    return (
      <Box width="100%" borderStyle="round" borderColor={theme.upload.uploadBorderText} backgroundColor={theme.global.mainBg} flexDirection="column">
        <Box paddingX={1} paddingY={1} flexDirection="column">
          <Text bold color={theme.upload.uploadTitleText}>
            ⚠ Overwrite Secret on AWS?
          </Text>
          <Text color={theme.upload.uploadSubtitleText}>This will update the secret permanently.</Text>
        </Box>
        <Box paddingX={1} paddingY={1} borderTop borderColor={theme.upload.uploadDiffDividerText}>
          {uploadPreview ? (
            <DiffViewer
              oldValue={uploadPreview.old}
              newValue={uploadPreview.new}
              scrollOffset={panelScrollOffset}
              visibleLines={diffVisibleLines}
            />
          ) : (
            <Text color={theme.upload.uploadLoadingText}>Loading preview...</Text>
          )}
        </Box>
        <Box paddingX={1} paddingY={1} borderTop borderColor={theme.upload.uploadConfirmPromptText}>
          <Text>
            Press{" "}
            <Text bold color={theme.upload.uploadConfirmKeyText}>
              y
            </Text>{" "}
            to confirm or{" "}
            <Text bold color={theme.upload.uploadCancelKeyText}>
              n
            </Text>{" "}
            to cancel
          </Text>
        </Box>
      </Box>
    );
  }

  if (describeState) {
    // Overhead: border 2 + title 1 + separator 1 + footer 2 = 6
    const detailVisibleLines = Math.max(1, tableHeight - 6);
    return (
      <Box width="100%" borderStyle="round" borderColor={theme.panel.detailPanelBorderText} backgroundColor={theme.global.mainBg}>
        <DetailPanel
          title={getCellLabel(describeState.row.cells.name) ?? describeState.row.id}
          fields={describeState.fields ?? []}
          isLoading={describeState.loading}
          scrollOffset={panelScrollOffset}
          visibleLines={detailVisibleLines}
        />
      </Box>
    );
  }

  if (histogramState) {
    return (
      <Box width="100%" borderStyle="round" borderColor={theme.panel.detailPanelBorderText} backgroundColor={theme.global.mainBg}>
        <HistogramPanel columnLabel={histogramState.columnLabel} bars={histogramState.bars} />
      </Box>
    );
  }

  if (filePreviewState && filePreviewNavigation) {
    return (
      <FilePreviewPanel
        previewState={filePreviewState}
        navigation={filePreviewNavigation}
        termCols={termCols}
        tableHeight={tableHeight}
        onFilterChange={onPreviewFilterChange ?? (() => {})}
        onFilterSubmit={onPreviewFilterSubmit ?? (() => {})}
      />
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
    <Box flexDirection="column" flexGrow={1}>
      {showSearchHistory && searchHistory && (
        <SearchHistoryDropdown
          history={searchHistory}
          selectedIndex={searchHistoryIndex ?? -1}
          visible={true}
        />
      )}
      <Table
        rows={displayRows}
        columns={columns}
        selectedIndex={selectedIndex}
        filterText={filterText}
        terminalWidth={termCols}
        maxHeight={tableHeight}
        scrollOffset={scrollOffset}
        contextLabel={adapter.getContextLabel?.() ?? ""}
        {...(footerContent !== undefined ? { footerContent } : {})}
        {...(selectedRowIds !== undefined ? { multiSelectedIds: selectedRowIds } : {})}
        {...(bookmarkedIds !== undefined ? { bookmarkedIds } : {})}
        {...(headerMarkers ? { headerMarkers } : {})}
        {...(sortState ? { sortState } : {})}
      />
    </Box>
  );
}
