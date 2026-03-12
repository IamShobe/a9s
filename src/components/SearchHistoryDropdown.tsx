import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../contexts/ThemeContext.js";

interface SearchHistoryDropdownProps {
  history: string[];
  selectedIndex: number; // -1 = none
  visible: boolean;
}

export function SearchHistoryDropdown({ history, selectedIndex, visible }: SearchHistoryDropdownProps) {
  const theme = useTheme();
  if (!visible || history.length === 0) return null;
  const recent = history.slice(0, 5);
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.panel.detailPanelBorderText}>
      {recent.map((entry, i) => (
        <Box key={entry} paddingX={1}>
          {i === selectedIndex ? (
            <Text backgroundColor={theme.table.selectedRowBg} color={theme.table.selectedRowText}>
              {" "}{entry}{" "}
            </Text>
          ) : (
            <Text color={theme.table.columnHeaderText}> {entry}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}
