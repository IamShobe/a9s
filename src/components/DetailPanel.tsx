import React from 'react';
import { Box, Text } from 'ink';
import type { DetailField } from '../adapters/ServiceAdapter.js';

interface DetailPanelProps {
  title: string;
  fields: DetailField[];
  isLoading: boolean;
}

export function DetailPanel({ title, fields, isLoading }: DetailPanelProps) {
  const labelWidth = Math.max(...fields.map((f) => f.label.length), 12);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text bold color="blue">{title}</Text>
      <Text color="gray">{'─'.repeat(40)}</Text>
      {isLoading ? (
        <Text color="gray">Loading...</Text>
      ) : (
        fields.map((f) => (
          <Box key={f.label}>
            <Text color="gray">{f.label.padEnd(labelWidth + 2)}</Text>
            <Text>{f.value}</Text>
          </Box>
        ))
      )}
      <Text color="gray">{'─'.repeat(40)}</Text>
      <Text color="gray">Esc  close</Text>
    </Box>
  );
}
