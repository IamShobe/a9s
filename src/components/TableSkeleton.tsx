import React from "react";
import { Box, Text } from "ink";
import type { ColumnDef } from "../types.js";
import { computeColumnWidths } from "./Table/widths.js";

interface TableSkeletonProps {
  columns: ColumnDef[];
  terminalWidth: number;
  rows?: number;
  contextLabel?: string;
}

function fill(len: number, ch = "░"): string {
  return ch.repeat(Math.max(1, len));
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str.padEnd(maxLen);
  return str.slice(0, Math.max(1, maxLen - 1)) + "…";
}

export function TableSkeleton({
  columns,
  terminalWidth,
  rows = 8,
  contextLabel,
}: TableSkeletonProps) {
  const FRAMES = ["░", "▒", "▓"] as const;
  const [frame, setFrame] = React.useState(0);
  const colWidths = computeColumnWidths(columns, terminalWidth);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % FRAMES.length);
    }, 180);
    return () => clearInterval(timer);
  }, []);

  const shade = FRAMES[frame] ?? "░";

  return (
    <Box flexDirection="column" flexGrow={1}>
      {contextLabel ? (
        <>
          <Text bold color="blue">
            {contextLabel}
          </Text>
          <Box height={1} />
        </>
      ) : null}

      <Box>
        {columns.map((col, i) => (
          <React.Fragment key={col.key}>
            {i > 0 ? <Text color="gray"> │ </Text> : null}
            <Text bold color="blue">
              {truncate(col.label, colWidths[i] ?? 1)}
            </Text>
          </React.Fragment>
        ))}
      </Box>

      <Text color="gray">{columns.map((_, i) => fill(colWidths[i] ?? 1, "─")).join("─┼─")}</Text>

      {Array.from({ length: rows }).map((_, rowIdx) => (
        <Box key={`skeleton-row-${rowIdx}`}>
          {columns.map((col, i) => (
            <React.Fragment key={`${col.key}-${rowIdx}`}>
              {i > 0 ? <Text color="gray"> │ </Text> : null}
              <Text color="gray">{fill(Math.max(1, colWidths[i] ?? 1), shade)}</Text>
            </React.Fragment>
          ))}
        </Box>
      ))}
    </Box>
  );
}
