import React from "react";
import { Box, Text } from "ink";

interface ErrorStatePanelProps {
  title: string;
  message: string;
  hint?: string;
}

export function ErrorStatePanel({ title, message, hint }: ErrorStatePanelProps) {
  return (
    <Box width="100%" borderStyle="round" borderColor="red">
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="red">
          {title}
        </Text>
        <Text>{message}</Text>
        {hint ? <Text color="gray">{hint}</Text> : null}
      </Box>
    </Box>
  );
}
