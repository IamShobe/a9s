import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../contexts/ThemeContext.js";
import { truncateNoPad } from "../utils/textUtils.js";

export interface HelpItem {
  key: string;
  description: string;
}

export interface HelpTab {
  title: string;
  items: HelpItem[];
}

interface HelpPanelProps {
  title: string;
  scopeLabel: string;
  tabs: HelpTab[];
  activeTab: number;
  terminalWidth: number;
  maxRows: number;
  scrollOffset: number;
}


export function HelpPanel({
  title,
  scopeLabel,
  tabs,
  activeTab,
  terminalWidth,
  maxRows,
  scrollOffset,
}: HelpPanelProps) {
  const theme = useTheme();
  const currentTab = tabs[activeTab] ?? tabs[0];
  const keyColWidth = 12;
  const descColWidth = Math.max(16, terminalWidth - keyColWidth - 8);
  const maxTabRowWidth = Math.max(16, terminalWidth - 2);
  const tabRow: Array<{ idx: number; label: string }> = [];
  let rowWidth = 0;
  for (let idx = 0; idx < tabs.length; idx += 1) {
    const shortTitle = truncateNoPad(tabs[idx]?.title ?? "Tab", 10);
    const label = ` ${idx + 1}:${shortTitle} `;
    if (rowWidth + label.length > maxTabRowWidth) break;
    tabRow.push({ idx, label });
    rowWidth += label.length;
  }

  const listRowsBudget = Math.max(1, maxRows);
  const visibleItems = (currentTab?.items ?? []).slice(scrollOffset, scrollOffset + listRowsBudget);

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      <Text bold color={theme.panel.panelTitleText}>
        {title}
      </Text>
      <Text color={theme.panel.panelHintText}>{scopeLabel}</Text>
      <Box>
        {tabRow.map((chip) => {
          const isActive = chip.idx === activeTab;
          return (
            <Text
              key={`chip-${chip.idx}`}
              {...(isActive
                ? { backgroundColor: theme.panel.activeTabBg, color: theme.panel.activeTabText }
                : { color: theme.panel.inactiveTabText })}
              bold={isActive}
            >
              {chip.label}
            </Text>
          );
        })}
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        {visibleItems.map((item, idx) => (
          <Box key={`${item.key}-${scrollOffset + idx}`}>
            <Text color={theme.panel.keyText} bold>
              {truncateNoPad(item.key, keyColWidth).padEnd(keyColWidth)}
            </Text>
            <Text>{truncateNoPad(item.description, descColWidth)}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
