import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../contexts/ThemeContext.js";
import type { HistogramBar } from "../utils/histogram.js";

interface HistogramPanelProps {
  columnLabel: string;
  bars: HistogramBar[] | null;
}

export function HistogramPanel({ columnLabel, bars }: HistogramPanelProps) {
  const theme = useTheme();
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.panel.detailPanelBorderText} padding={1}>
      <Text bold color={theme.table.columnHeaderText}>{columnLabel} — distribution</Text>
      <Box height={1} />
      {bars === null ? (
        <Text color={theme.table.emptyStateText}>Not a numeric column</Text>
      ) : (
        bars.map((bar, i) => (
          <Box key={i} flexDirection="row">
            <Text color={theme.table.columnHeaderText}>{bar.rangeLabel.padStart(18)} </Text>
            <Text color="cyan">{bar.bar}</Text>
            <Text color={theme.table.scrollPositionText}> ({bar.count})</Text>
          </Box>
        ))
      )}
      <Box height={1} />
      <Text color={theme.table.emptyStateText}>Esc to close</Text>
    </Box>
  );
}
