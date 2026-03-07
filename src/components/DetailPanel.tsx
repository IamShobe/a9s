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
  const THEME = useTheme();
  const labelWidth = Math.max(...fields.map((f) => f.label.length), 12);

  const clampedOffset = clampScrollOffset(scrollOffset, fields.length, visibleLines);
  const visibleFields = fields.slice(clampedOffset, clampedOffset + visibleLines);
  const { hasMoreAbove, hasMoreBelow } = scrollIndicators(clampedOffset, fields.length, visibleLines);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text bold color={THEME.panel.panelTitleText}>
        {title}
      </Text>
      <Text color={THEME.panel.panelDividerText}>{"─".repeat(40)}</Text>
      {isLoading ? (
        <Text color={THEME.panel.panelHintText}>Loading...</Text>
      ) : (
        <>
          {hasMoreAbove && (
            <Text color={THEME.panel.panelHintText} dimColor>
              ↑ {clampedOffset} more above
            </Text>
          )}
          {visibleFields.map((f) => (
            <Box key={f.label}>
              <Text color={THEME.panel.detailFieldLabelText}>{f.label.padEnd(labelWidth + 2)}</Text>
              <Text>{f.value}</Text>
            </Box>
          ))}
          {hasMoreBelow && (
            <Text color={THEME.panel.panelHintText} dimColor>
              ↓ {fields.length - clampedOffset - visibleLines} more below
            </Text>
          )}
        </>
      )}
      <Text color={THEME.panel.panelDividerText}>{"─".repeat(40)}</Text>
      <Text color={THEME.panel.panelHintText}>j/k scroll • Esc close</Text>
    </Box>
  );
}
