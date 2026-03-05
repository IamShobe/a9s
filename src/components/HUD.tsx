import React from 'react';
import { Box, Text } from 'ink';

interface HUDProps {
  serviceLabel: string;
  hudColor: { bg: string; fg: string };
  path: string;
  terminalWidth: number;
}

export function HUD({ serviceLabel, hudColor, path, terminalWidth }: HUDProps) {
  const label = ` ${serviceLabel.toUpperCase()} `;
  const pathDisplay = ` ${path} `;
  const padLen = Math.max(0, terminalWidth - label.length - pathDisplay.length);

  return (
    <Box>
      <Text backgroundColor={hudColor.bg} color={hudColor.fg} bold>
        {label}
      </Text>
      <Text backgroundColor="gray" color="white">
        {pathDisplay}
        {' '.repeat(padLen)}
      </Text>
    </Box>
  );
}
