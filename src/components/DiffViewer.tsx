import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../contexts/ThemeContext.js";
import { clampScrollOffset, scrollIndicators } from "../utils/scrollUtils.js";

// Chrome lines: header(1) + divider(1)
const DIFF_CHROME = 2;

interface DiffViewerProps {
  oldValue: string;
  newValue: string;
  scrollOffset: number;
  availableHeight: number;
}

export function DiffViewer({ oldValue, newValue, scrollOffset, availableHeight }: DiffViewerProps) {
  const theme = useTheme();
  const oldLines = oldValue.split("\n");
  const newLines = newValue.split("\n");
  const maxLines = Math.max(oldLines.length, newLines.length);

  const baseVisible = Math.max(1, availableHeight - DIFF_CHROME);
  const { hasMoreAbove: preAbove, hasMoreBelow: preBelow } = scrollIndicators(
    clampScrollOffset(scrollOffset, maxLines, baseVisible),
    maxLines,
    baseVisible,
  );
  const indicatorLines = (preAbove ? 1 : 0) + (preBelow ? 1 : 0);
  const visibleLines = Math.max(1, baseVisible - indicatorLines);

  const clampedOffset = clampScrollOffset(scrollOffset, maxLines, visibleLines);
  const oldDisplay = oldLines.slice(clampedOffset, clampedOffset + visibleLines).join("\n");
  const newDisplay = newLines.slice(clampedOffset, clampedOffset + visibleLines).join("\n");
  const { hasMoreAbove, hasMoreBelow } = scrollIndicators(clampedOffset, maxLines, visibleLines);

  // Calculate column width
  const colWidth = 35;

  return (
    <Box flexDirection="column" gap={0}>
      {/* Header */}
      <Box gap={2}>
        <Box width={colWidth}>
          <Text color={theme.diff.originalHeaderText} bold>
            Original
          </Text>
        </Box>
        <Box>
          <Text color={theme.diff.updatedHeaderText} bold>
            Updated
          </Text>
        </Box>
      </Box>

      {/* Divider */}
      <Box gap={2}>
        <Box width={colWidth}>
          <Text color={theme.diff.diffDividerText}>{"-".repeat(30)}</Text>
        </Box>
        <Text color={theme.diff.diffDividerText}>{"-".repeat(30)}</Text>
      </Box>

      {/* Content */}
      <Box gap={2} flexDirection="column">
        {hasMoreAbove && (
          <Box gap={2}>
            <Box width={colWidth}>
              <Text color={theme.diff.diffDividerText} dimColor>
                ↑ {clampedOffset} lines above
              </Text>
            </Box>
            <Text color={theme.diff.diffDividerText} dimColor>
              ↑ {clampedOffset} lines above
            </Text>
          </Box>
        )}

        <Box gap={2}>
          <Box width={colWidth}>
            <Text>{oldDisplay}</Text>
          </Box>
          <Box>
            <Text>{newDisplay}</Text>
          </Box>
        </Box>

        {hasMoreBelow && (
          <Box gap={2}>
            <Box width={colWidth}>
              <Text color={theme.diff.diffDividerText} dimColor>
                ↓ {maxLines - clampedOffset - visibleLines} more lines
              </Text>
            </Box>
            <Text color={theme.diff.diffDividerText} dimColor>
              ↓ {maxLines - clampedOffset - visibleLines} more lines
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
