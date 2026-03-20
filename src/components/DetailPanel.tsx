import React from "react";
import { Box, Text } from "ink";
import type { DetailField } from "../adapters/ServiceAdapter.js";
import { useTheme } from "../contexts/ThemeContext.js";
import { clampScrollOffset, scrollIndicators } from "../utils/scrollUtils.js";

// Chrome lines: border(2) + title(1) + topDivider(1) + bottomDivider(1) + hint(1)
const CHROME = 6;

interface DetailPanelProps {
  title: string;
  fields: DetailField[];
  isLoading: boolean;
  scrollOffset: number;
  availableHeight: number;
}

export function DetailPanel({
  title,
  fields,
  isLoading,
  scrollOffset,
  availableHeight,
}: DetailPanelProps) {
  const theme = useTheme();
  const labelWidth = Math.max(...fields.map((f) => f.label.length), 12);

  const baseVisible = Math.max(1, availableHeight - CHROME);
  const { hasMoreAbove, hasMoreBelow } = scrollIndicators(
    clampScrollOffset(scrollOffset, fields.length, baseVisible),
    fields.length,
    baseVisible,
  );
  const indicatorLines = (hasMoreAbove ? 1 : 0) + (hasMoreBelow ? 1 : 0);
  const visibleLines = Math.max(1, baseVisible - indicatorLines);

  const clampedOffset = clampScrollOffset(scrollOffset, fields.length, visibleLines);
  const visibleFields = fields.slice(clampedOffset, clampedOffset + visibleLines);

  return (
    <Box width="100%" borderStyle="round" borderColor={theme.panel.detailPanelBorderText} backgroundColor={theme.global.mainBg}>
      <Box flexDirection="column" paddingX={1}>
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
    </Box>
  );
}
