import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { Table } from "./Table/index.js";
import { AdvancedTextInput } from "./AdvancedTextInput.js";
import { useTheme } from "../contexts/ThemeContext.js";
import type { FilePreviewState } from "../hooks/useFilePreview.js";
import type { useNavigation } from "../hooks/useNavigation.js";

// Minimum character width per column (excluding " │ " gap of 3 chars)
export const MIN_COL_WIDTH = 14;
export const GAP = 3;

const YANK_CHARS = "abcdefghijklmnopqrstuvwxyz";

interface FilePreviewPanelProps {
  previewState: FilePreviewState;
  navigation: ReturnType<typeof useNavigation>;
  termCols: number;
  tableHeight: number;
  onFilterChange: (text: string) => void;
  onFilterSubmit: () => void;
  previewYankMode?: boolean;
}

function filterRows(state: FilePreviewState) {
  const text = state.filterText.trim().toLowerCase();
  if (!text) return state.rows;
  return state.rows.filter((row) =>
    Object.values(row.cells).some((cell) =>
      (cell?.displayName ?? "").toLowerCase().includes(text),
    ),
  );
}

export function FilePreviewPanel({
  previewState,
  navigation,
  termCols,
  tableHeight,
  onFilterChange,
  onFilterSubmit,
  previewYankMode = false,
}: FilePreviewPanelProps) {
  const theme = useTheme();

  const filteredRows = useMemo(() => filterRows(previewState), [previewState]);

  // Compute visible column window
  const colsPerScreen = Math.max(1, Math.floor(termCols / (MIN_COL_WIDTH + GAP)));
  const colOffset = previewState.colOffset;
  const visibleColumns = useMemo(
    () => previewState.columns.slice(colOffset, colOffset + colsPerScreen),
    [previewState.columns, colOffset, colsPerScreen],
  );
  const visibleColKeySet = useMemo(
    () => new Set(visibleColumns.map((c) => c.key)),
    [visibleColumns],
  );
  const displayRows = useMemo(
    () =>
      filteredRows.map((row) => ({
        ...row,
        cells: Object.fromEntries(
          Object.entries(row.cells).filter(([k]) => visibleColKeySet.has(k)),
        ),
      })),
    [filteredRows, visibleColKeySet],
  );

  const { currentPage, totalPages, totalRows } = previewState;
  const pageStart = currentPage * 10_000 + 1;
  const pageEnd = Math.min((currentPage + 1) * 10_000, totalRows);
  const totalCols = previewState.columns.length;
  const colFrom = colOffset + 1;
  const colTo = colOffset + visibleColumns.length;

  const statusText = totalRows > 0
    ? `rows ${pageStart}–${pageEnd} of ${totalRows}`
    : "No data";
  const colStatus = totalCols > 0
    ? `cols ${colFrom}–${colTo}/${totalCols}`
    : "";
  const pageStatus = totalPages > 1 ? `page ${currentPage + 1}/${totalPages}` : "";
  const statusParts = [colStatus, pageStatus, statusText].filter(Boolean).join(" • ");

  const filterHint = previewState.filterActive ? "" : " • / filter";
  const footerText = `j/k gg G scroll • [/] page • ←/→ cols${filterHint} • y yank • Esc close`;
  const yankHint = visibleColumns
    .map((col, i) => `${YANK_CHARS[i] ?? "?"} ${col.label}`)
    .join(" • ") + " • Esc cancel";

  const yankHeaderMarkers = previewYankMode
    ? Object.fromEntries(visibleColumns.map((col, i) => [col.key, [YANK_CHARS[i] ?? "?"]]))
    : undefined;

  const contextLabel = previewState.isLoading
    ? `Loading ${previewState.fileName || "…"}`
    : `${previewState.fileName}${statusParts ? ` | ${statusParts}` : ""}`;

  const footerContent = (
    <Box flexDirection="row" justifyContent="space-between">
      {previewState.filterActive ? (
        <Box flexDirection="row">
          <Text color={theme.panel.panelTitleText}>/ </Text>
          <AdvancedTextInput
            value={previewState.filterText}
            onChange={onFilterChange}
            onSubmit={onFilterSubmit}
            focus
          />
        </Box>
      ) : previewYankMode ? (
        <Text color={theme.panel.panelTitleText}>{yankHint}</Text>
      ) : (
        <Text color={theme.panel.panelHintText}>{footerText}</Text>
      )}
    </Box>
  );

  if (previewState.error) {
    return (
      <Box
        width="100%"
        borderStyle="round"
        borderColor={theme.error.errorBorderText}
        flexDirection="column"
        padding={1}
      >
        <Text color={theme.error.errorTitleText} bold>
          Preview Error: {previewState.fileName}
        </Text>
        <Text color={theme.error.errorHintText}>{previewState.error}</Text>
        <Text color={theme.panel.panelHintText}>Press Esc to close</Text>
      </Box>
    );
  }

  return (
    <Box width="100%" borderStyle="round" borderColor={theme.panel.detailPanelBorderText}>
      <Table
        rows={displayRows}
        columns={visibleColumns}
        selectedIndex={navigation.selectedIndex}
        filterText={previewState.filterText}
        terminalWidth={termCols - 2}
        maxHeight={tableHeight}
        scrollOffset={navigation.scrollOffset}
        contextLabel={contextLabel}
        footerContent={footerContent}
        {...(yankHeaderMarkers ? { headerMarkers: yankHeaderMarkers } : {})}
      />
    </Box>
  );
}
