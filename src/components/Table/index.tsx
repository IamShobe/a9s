import React, { useMemo } from "react";
import { Box, Text } from "ink";
import type { ColumnDef, TableRow } from "../../types.js";
import { computeColumnWidths } from "./widths.js";
import { useTheme } from "../../contexts/ThemeContext.js";
import type { ThemeTokens } from "../../constants/theme.js";

interface TableProps {
  columns: ColumnDef[];
  rows: TableRow[]; // Pre-filtered by parent
  selectedIndex: number;
  filterText: string;
  terminalWidth: number;
  maxHeight: number;
  scrollOffset: number;
  contextLabel?: string;
  headerMarkers?: Record<string, string[]>;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str.padEnd(maxLen);
  return str.slice(0, maxLen - 1) + "…";
}

function truncateNoPad(str: string, maxLen: number): string {
  if (maxLen <= 0) return "";
  if (str.length <= maxLen) return str;
  if (maxLen === 1) return "…";
  return str.slice(0, maxLen - 1) + "…";
}

function highlightMatch(
  text: string,
  filter: string,
  isSelected: boolean,
  theme: ThemeTokens,
): React.ReactNode[] {
  if (!filter || !text) return [text];

  const parts: React.ReactNode[] = [];
  const lowerText = text.toLowerCase();
  const lowerFilter = filter.toLowerCase();
  let lastIdx = 0;

  const highlightColor = isSelected ? theme.table.filterMatchSelectedText : theme.table.filterMatchText;

  let idx = lowerText.indexOf(lowerFilter);
  while (idx !== -1) {
    if (idx > lastIdx) {
      parts.push(text.slice(lastIdx, idx));
    }
    parts.push(
      <Text key={`match-${idx}`} color={highlightColor} bold>
        {text.slice(idx, idx + filter.length)}
      </Text>,
    );
    lastIdx = idx + filter.length;
    idx = lowerText.indexOf(lowerFilter, lastIdx);
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts.length > 0 ? parts : [text];
}

interface RowProps {
  row: TableRow;
  isSelected: boolean;
  columns: ColumnDef[];
  colWidths: number[];
  filterText: string;
}

const Row = React.memo(function Row({ row, isSelected, columns, colWidths, filterText }: RowProps) {
  const THEME = useTheme();
  const parts: React.ReactNode[] = [];
  columns.forEach((col, i) => {
    if (i > 0)
      parts.push(
        <Text key={`sep-${i}`} color={THEME.table.rowSeparatorText}>
          {" "}
          │{" "}
        </Text>,
      );

    const cellData = row.cells[col.key] ?? "";
    const cellValue = typeof cellData === "string" ? cellData : cellData.displayName;
    const truncated = truncate(cellValue, colWidths[i]!);
    const highlighted =
      filterText && truncated ? highlightMatch(truncated, filterText, isSelected, THEME) : [truncated];

    if (isSelected) {
      parts.push(
        <Text key={`cell-${i}`} color={THEME.table.selectedRowText} bold>
          {highlighted}
        </Text>,
      );
    } else {
      parts.push(<Text key={`cell-${i}`}>{highlighted}</Text>);
    }
  });

  return isSelected ? <Box backgroundColor={THEME.table.selectedRowBg}>{parts}</Box> : <Box>{parts}</Box>;
});

export const Table = React.memo(function Table({
  columns,
  rows,
  selectedIndex,
  filterText,
  terminalWidth,
  maxHeight,
  scrollOffset,
  contextLabel,
  headerMarkers,
}: TableProps) {
  const THEME = useTheme();
  // Memoize column widths computation
  const colWidths = useMemo(
    () => computeColumnWidths(columns, terminalWidth),
    [columns, terminalWidth],
  );

  // Rows are pre-filtered by parent, no need to filter again
  const visibleRows = rows.slice(scrollOffset, scrollOffset + maxHeight);
  const adjustedSelected = selectedIndex - scrollOffset;

  const renderHeader = () => {
    const parts: React.ReactNode[] = [];
    columns.forEach((col, i) => {
      if (i > 0)
        parts.push(
          <Text key={`sep-${i}`} color={THEME.table.rowSeparatorText}>
            {" "}
            │{" "}
          </Text>,
        );
      const width = colWidths[i]!;
      const markers = headerMarkers?.[col.key] ?? [];
      const markerText = markers.length > 0 ? ` [${markers.join(",")}]` : "";

      if (!markerText) {
        parts.push(
          <Text key={col.key} bold color={THEME.table.columnHeaderText}>
            {truncate(col.label, width)}
          </Text>,
        );
        return;
      }

      if (markerText.length >= width) {
        const markerDisplay = truncate(markerText, width);
        parts.push(
          <Text key={`${col.key}-markers-only`} color={THEME.table.columnHeaderMarker}>
            {markerDisplay}
          </Text>,
        );
        return;
      }

      const labelMax = width - markerText.length;
      const labelDisplay = truncateNoPad(col.label, labelMax);
      const trailingPadLen = Math.max(0, width - (labelDisplay.length + markerText.length));

      parts.push(
        <Text key={`${col.key}-label`} bold color={THEME.table.columnHeaderText}>
          {labelDisplay}
        </Text>,
      );
      parts.push(
        <Text key={`${col.key}-markers`} color={THEME.table.columnHeaderMarker}>
          {markerText}
        </Text>,
      );
      if (trailingPadLen > 0) {
        parts.push(
          <Text key={`${col.key}-pad`} color={THEME.table.columnHeaderText}>
            {" ".repeat(trailingPadLen)}
          </Text>,
        );
      }
    });
    return <Box>{parts}</Box>;
  };

  const renderDivider = () => (
    <Text color={THEME.table.rowSeparatorText}>
      {columns.map((col, i) => "─".repeat(colWidths[i]!)).join("─┼─")}
    </Text>
  );

  const renderEmpty = () => (
    <Text color={THEME.table.emptyStateText}>
      {filterText ? `No results for "${filterText}"` : "No items"}
    </Text>
  );

  if (rows.length === 0) {
    return (
      <Box flexDirection="column">
        {contextLabel && (
          <Text bold color={THEME.table.columnHeaderText}>
            {contextLabel}
          </Text>
        )}
        {contextLabel && <Box height={1} />}
        {renderHeader()}
        {renderDivider()}
        {renderEmpty()}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {contextLabel && (
        <>
          <Text bold color={THEME.table.columnHeaderText}>
            {contextLabel}
          </Text>
          <Box height={1} />
        </>
      )}
      {renderHeader()}
      {renderDivider()}
      <Box flexDirection="column" flexGrow={1}>
        {visibleRows.map((row, i) => (
          <Row
            key={row.id}
            row={row}
            isSelected={i === adjustedSelected}
            columns={columns}
            colWidths={colWidths}
            filterText={filterText}
          />
        ))}
      </Box>
      {rows.length > maxHeight && (
        <Box paddingTop={1}>
          <Text color={THEME.table.scrollPositionText}>
            {scrollOffset + visibleRows.length} / {rows.length} items
          </Text>
        </Box>
      )}
    </Box>
  );
});
