import React from "react";
import { Box, Text } from "ink";
import type { DetailField } from "../adapters/ServiceAdapter.js";
import { useTheme } from "../contexts/ThemeContext.js";
import { clampScrollOffset, scrollIndicators } from "../utils/scrollUtils.js";

interface DetailPanelProps {
  title: string;
  fields: DetailField[];
  isLoading: boolean;
  scrollOffset: number;
  visibleLines: number;
}

export function DetailPanel({
  title,
  fields,
  isLoading,
  scrollOffset,
  visibleLines,
}: DetailPanelProps) {
  const theme = useTheme();
  const labelWidth = Math.max(...fields.map((f) => f.label.length), 12);

  const clampedOffset = clampScrollOffset(scrollOffset, fields.length, visibleLines);
  const visibleFields = fields.slice(clampedOffset, clampedOffset + visibleLines);
  const { hasMoreAbove, hasMoreBelow } = scrollIndicators(clampedOffset, fields.length, visibleLines);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text bold color={theme.panel.panelTitleText}>
        {title}
      </Text>
      <Text color={theme.panel.panelDividerText}>{"─".repeat(40)}</Text>
      {isLoading ? (
        <Text color={theme.panel.panelHintText}>Loading...</Text>
      ) : (
        <>
          {hasMoreAbove && (
            <Text color={theme.panel.panelHintText} dimColor>
              ↑ {clampedOffset} more above
            </Text>
          )}
          {visibleFields.map((f) => (
            <Box key={f.label}>
              <Text color={theme.panel.detailFieldLabelText}>{f.label.padEnd(labelWidth + 2)}</Text>
              <Text>{f.value}</Text>
            </Box>
          ))}
          {hasMoreBelow && (
            <Text color={theme.panel.panelHintText} dimColor>
              ↓ {fields.length - clampedOffset - visibleLines} more below
            </Text>
          )}
        </>
      )}
      <Text color={theme.panel.panelDividerText}>{"─".repeat(40)}</Text>
      <Text color={theme.panel.panelHintText}>j/k scroll • Esc close</Text>
    </Box>
  );
}
