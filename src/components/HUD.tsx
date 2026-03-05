import React from 'react';
import { Box, Text } from 'ink';

interface HUDProps {
  serviceLabel: string;
  hudColor: { bg: string; fg: string };
  path: string;
  accountName: string;
  accountId: string;
  awsProfile: string;
  currentIdentity: string;
  region: string;
  terminalWidth: number;
}

export function HUD({
  serviceLabel,
  hudColor,
  path,
  accountName,
  accountId,
  awsProfile,
  currentIdentity,
  region,
  terminalWidth,
}: HUDProps) {
  const truncate = (value: string, max: number) =>
    value.length > max ? `${value.slice(0, Math.max(1, max - 1))}…` : value;

  const nameMaxLen = Math.max(8, terminalWidth - 44);
  const compactName =
    accountName.length > nameMaxLen
      ? `${accountName.slice(0, nameMaxLen - 1)}…`
      : accountName;
  const idPart = `(${accountId})`;
  const profilePart = `[${awsProfile}]`;
  const topLineRaw = `${compactName}${idPart}·${region}·${profilePart}`;
  const topPadLen = Math.max(0, terminalWidth - topLineRaw.length);
  const identityLine = truncate(currentIdentity || "-", Math.max(1, terminalWidth));
  const identityPadLen = Math.max(0, terminalWidth - identityLine.length);
  const label = ` ${serviceLabel.toUpperCase()} `;
  const pathDisplay = ` ${path} `;
  const padLen = Math.max(0, terminalWidth - label.length - pathDisplay.length);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="blue" bold>{compactName}</Text>
        <Text color="yellow" bold>{idPart}</Text>
        <Text color="gray" bold>·</Text>
        <Text color="green" bold>{region}</Text>
        <Text color="gray" bold>·</Text>
        <Text color="magenta" bold>{profilePart}</Text>
        <Text>{" ".repeat(topPadLen)}</Text>
      </Box>
      <Text color="cyan" wrap="truncate-end">
        {identityLine}
        {" ".repeat(identityPadLen)}
      </Text>
      <Box>
        <Text backgroundColor={hudColor.bg} color={hudColor.fg} bold>
          {label}
        </Text>
        <Text backgroundColor="gray" color="white">
          {pathDisplay}
          {" ".repeat(padLen)}
        </Text>
      </Box>
    </Box>
  );
}
