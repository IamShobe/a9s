import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { Table } from "./Table/index.js";
import { AdvancedTextInput } from "./AdvancedTextInput.js";
import { useTheme } from "../contexts/ThemeContext.js";
import type { FilePreviewState } from "../hooks/useFilePreview.js";
import type { useNavigation } from "../hooks/useNavigation.js";

interface FilePreviewPanelProps {
  previewState: FilePreviewState;
  navigation: ReturnType<typeof useNavigation>;
  termCols: number;
  tableHeight: number;
  onFilterChange: (text: string) => void;
  onFilterSubmit: () => void;
}

function filterRows(state: FilePreviewState) {
  const text = state.filterText.trim().toLowerCase();
  if (!text) return state.rows;
  return state.rows.filter((row) =>
    Object.values(row.cells).some((cell) =>
      cell?.displayName.toLowerCase().includes(text),
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
}: FilePreviewPanelProps) {
  const theme = useTheme();

  const displayRows = useMemo(() => filterRows(previewState), [previewState]);

  const { currentPage, totalPages, totalRows } = previewState;
  const pageStart = currentPage * 10_000 + 1;
  const pageEnd = Math.min((currentPage + 1) * 10_000, totalRows);
  const statusText = totalRows > 0
    ? `Page ${currentPage + 1}/${totalPages} • rows ${pageStart}–${pageEnd} of ${totalRows}`
    : "No data";

  const filterHint = previewState.filterActive
    ? ""
    : " • / filter";

  const footerText = `j/k scroll • [/] page${filterHint} • Esc close`;

  const contextLabel = previewState.isLoading
    ? `Loading ${previewState.fileName || "…"}`
    : `${previewState.fileName} | ${statusText}`;

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
        columns={previewState.columns}
        selectedIndex={navigation.selectedIndex}
        filterText=""
        terminalWidth={termCols}
        maxHeight={tableHeight}
        scrollOffset={navigation.scrollOffset}
        contextLabel={contextLabel}
        footerContent={footerContent}
      />
    </Box>
  );
}
