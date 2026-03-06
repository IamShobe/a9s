import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../contexts/ThemeContext.js";

interface ErrorStatePanelProps {
  title: string;
  message: string;
  hint?: string;
}

export function ErrorStatePanel({ title, message, hint }: ErrorStatePanelProps) {
  const THEME = useTheme();
  return (
    <Box width="100%" borderStyle="round" borderColor={THEME.error.errorBorderText}>
      <Box flexDirection="column" paddingX={1}>
        <Text bold color={THEME.error.errorTitleText}>
          {title}
        </Text>
        <Text>{message}</Text>
        {hint ? <Text color={THEME.error.errorHintText}>{hint}</Text> : null}
      </Box>
    </Box>
  );
}
