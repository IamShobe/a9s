import React from "react";
import { Box, Text } from "ink";

interface DiffViewerProps {
  oldValue: string;
  newValue: string;
  scrollOffset: number;
  visibleLines: number;
}

export function DiffViewer({ oldValue, newValue, scrollOffset, visibleLines }: DiffViewerProps) {
  const oldLines = oldValue.split("\n");
  const newLines = newValue.split("\n");
  const maxLines = Math.max(oldLines.length, newLines.length);

  // Clamp scrollOffset to valid range
  const clampedOffset = Math.max(0, Math.min(scrollOffset, Math.max(0, maxLines - visibleLines)));

  // Show visible lines only
  const oldDisplay = oldLines.slice(clampedOffset, clampedOffset + visibleLines).join("\n");
  const newDisplay = newLines.slice(clampedOffset, clampedOffset + visibleLines).join("\n");

  const hasMoreAbove = clampedOffset > 0;
  const hasMoreBelow = clampedOffset + visibleLines < maxLines;

  // Calculate column width
  const colWidth = 35;

  return (
    <Box flexDirection="column" gap={0}>
      {/* Header */}
      <Box gap={2}>
        <Box width={colWidth}>
          <Text color="red" bold>
            Original
          </Text>
        </Box>
        <Box>
          <Text color="green" bold>
            Updated
          </Text>
        </Box>
      </Box>

      {/* Divider */}
      <Box gap={2}>
        <Box width={colWidth}>
          <Text color="gray">{"-".repeat(30)}</Text>
        </Box>
        <Text color="gray">{"-".repeat(30)}</Text>
      </Box>

      {/* Content */}
      <Box gap={2} flexDirection="column">
        {hasMoreAbove && (
          <Box gap={2}>
            <Box width={colWidth}>
              <Text color="gray" dimColor>
                ↑ {clampedOffset} lines above
              </Text>
            </Box>
            <Text color="gray" dimColor>
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
              <Text color="gray" dimColor>
                ↓ {maxLines - clampedOffset - visibleLines} more lines
              </Text>
            </Box>
            <Text color="gray" dimColor>
              ↓ {maxLines - clampedOffset - visibleLines} more lines
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
