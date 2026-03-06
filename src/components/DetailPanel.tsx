import React from "react";
import { Box, Text } from "ink";
import type { DetailField } from "../adapters/ServiceAdapter.js";

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
  const labelWidth = Math.max(...fields.map((f) => f.label.length), 12);

  // Clamp scrollOffset to valid range
  const clampedOffset = Math.max(
    0,
    Math.min(scrollOffset, Math.max(0, fields.length - visibleLines)),
  );

  // Show visible fields only
  const visibleFields = fields.slice(clampedOffset, clampedOffset + visibleLines);
  const hasMoreAbove = clampedOffset > 0;
  const hasMoreBelow = clampedOffset + visibleLines < fields.length;

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text bold color="blue">
        {title}
      </Text>
      <Text color="gray">{"─".repeat(40)}</Text>
      {isLoading ? (
        <Text color="gray">Loading...</Text>
      ) : (
        <>
          {hasMoreAbove && (
            <Text color="gray" dimColor>
              ↑ {clampedOffset} more above
            </Text>
          )}
          {visibleFields.map((f) => (
            <Box key={f.label}>
              <Text color="gray">{f.label.padEnd(labelWidth + 2)}</Text>
              <Text>{f.value}</Text>
            </Box>
          ))}
          {hasMoreBelow && (
            <Text color="gray" dimColor>
              ↓ {fields.length - clampedOffset - visibleLines} more below
            </Text>
          )}
        </>
      )}
      <Text color="gray">{"─".repeat(40)}</Text>
      <Text color="gray">j/k scroll • Esc close</Text>
    </Box>
  );
}
