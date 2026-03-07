import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../contexts/ThemeContext.js";

interface ErrorStatePanelProps {
  title: string;
  message: string;
  hint?: string;
}

export function ErrorStatePanel({ title, message, hint }: ErrorStatePanelProps) {
  const theme = useTheme();
  return (
    <Box width="100%" borderStyle="round" borderColor={theme.error.errorBorderText} backgroundColor={theme.global.mainBg}>
      <Box flexDirection="column" paddingX={1}>
        <Text bold color={theme.error.errorTitleText}>
          {title}
        </Text>
        <Text>{message}</Text>
        {hint ? <Text color={theme.error.errorHintText}>{hint}</Text> : null}
      </Box>
    </Box>
  );
}
