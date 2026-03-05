import React from "react";
import { Box, Text } from "ink";

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

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  if (maxLen <= 1) return "…";
  return `${text.slice(0, maxLen - 1)}…`;
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
  const currentTab = tabs[activeTab] ?? tabs[0];
  const keyColWidth = 12;
  const descColWidth = Math.max(16, terminalWidth - keyColWidth - 8);
  const maxTabRowWidth = Math.max(16, terminalWidth - 2);
  const tabRow: Array<{ idx: number; label: string }> = [];
  let rowWidth = 0;
  for (let idx = 0; idx < tabs.length; idx += 1) {
    const shortTitle = truncate(tabs[idx]?.title ?? "Tab", 10);
    const label = ` ${idx + 1}:${shortTitle} `;
    if (rowWidth + label.length > maxTabRowWidth) break;
    tabRow.push({ idx, label });
    rowWidth += label.length;
  }

  const listRowsBudget = Math.max(1, maxRows);
  const visibleItems = (currentTab?.items ?? []).slice(
    scrollOffset,
    scrollOffset + listRowsBudget,
  );

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      <Text bold color="blue">
        {title}
      </Text>
      <Text color="gray">{scopeLabel}</Text>
      <Box>
        {tabRow.map((chip) => {
          const isActive = chip.idx === activeTab;
          return (
            <Text
              key={`chip-${chip.idx}`}
              {...(isActive
                ? { backgroundColor: "blue" as const, color: "white" as const }
                : { color: "cyan" as const })}
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
            <Text color="yellow" bold>
              {truncate(item.key, keyColWidth).padEnd(keyColWidth)}
            </Text>
            <Text>{truncate(item.description, descColWidth)}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
