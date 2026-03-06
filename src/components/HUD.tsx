import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../contexts/ThemeContext.js";

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
  loading?: boolean;
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
  loading = false,
}: HUDProps) {
  const THEME = useTheme();
  const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const [spinnerIndex, setSpinnerIndex] = React.useState(0);

  React.useEffect(() => {
    if (!loading) {
      setSpinnerIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setSpinnerIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 120);
    return () => clearInterval(timer);
  }, [loading]);

  const truncate = (value: string, max: number) =>
    value.length > max ? `${value.slice(0, Math.max(1, max - 1))}…` : value;

  const nameMaxLen = Math.max(8, terminalWidth - 44);
  const compactName =
    accountName.length > nameMaxLen ? `${accountName.slice(0, nameMaxLen - 1)}…` : accountName;
  const idPart = `(${accountId})`;
  const profilePart = `[${awsProfile}]`;
  const leftTopRaw = `${compactName}${idPart}·${region}·${profilePart}`;
  const spinnerWidth = loading ? 1 : 0;
  const topPadLen = Math.max(0, terminalWidth - leftTopRaw.length - spinnerWidth);
  const identityLine = truncate(currentIdentity || "-", Math.max(1, terminalWidth));
  const identityPadLen = Math.max(0, terminalWidth - identityLine.length);
  const label = ` ${serviceLabel.toUpperCase()} `;
  const pathDisplay = ` ${path} `;
  const padLen = Math.max(0, terminalWidth - label.length - pathDisplay.length);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={THEME.hud.accountNameText} bold>
          {compactName}
        </Text>
        <Text color={THEME.hud.accountIdText} bold>
          {idPart}
        </Text>
        <Text color={THEME.hud.separatorText} bold>
          ·
        </Text>
        <Text color={THEME.hud.regionText} bold>
          {region}
        </Text>
        <Text color={THEME.hud.separatorText} bold>
          ·
        </Text>
        <Text color={THEME.hud.profileText} bold>
          {profilePart}
        </Text>
        <Text>{" ".repeat(topPadLen)}</Text>
        {loading ? (
          <Text color={THEME.hud.loadingSpinnerText} bold>
            {SPINNER_FRAMES[spinnerIndex]}
          </Text>
        ) : null}
      </Box>
      <Text color={THEME.hud.currentIdentityText} wrap="truncate-end">
        {identityLine}
        {" ".repeat(identityPadLen)}
      </Text>
      <Box>
        <Text backgroundColor={hudColor.bg} color={hudColor.fg} bold>
          {label}
        </Text>
        <Text backgroundColor={THEME.hud.pathBarBg} color={THEME.hud.pathBarText}>
          {pathDisplay}
          {" ".repeat(padLen)}
        </Text>
      </Box>
    </Box>
  );
}
