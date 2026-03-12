import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../contexts/ThemeContext.js";
import { truncateNoPad } from "../utils/textUtils.js";

interface AwsContextInfo {
  accountName: string;
  accountId: string;
  awsProfile: string;
  currentIdentity: string;
  region: string;
}

interface HUDProps {
  serviceLabel: string;
  hudColor: { bg: string; fg: string };
  path: string;
  context: AwsContextInfo;
  terminalWidth: number;
  loading?: boolean;
  watchInterval?: number | null;
  tagFilter?: { key: string; value: string } | null;
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function HUD({
  serviceLabel,
  hudColor,
  path,
  context: { accountName, accountId, awsProfile, currentIdentity, region },
  terminalWidth,
  loading = false,
  watchInterval = null,
  tagFilter = null,
}: HUDProps) {
  const theme = useTheme();
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

  const watchText = watchInterval != null ? ` ⟳${watchInterval}s` : "";
  const nameMaxLen = Math.max(8, terminalWidth - 44);
  const compactName =
    accountName.length > nameMaxLen ? `${accountName.slice(0, nameMaxLen - 1)}…` : accountName;
  const idPart = `(${accountId})`;
  const profilePart = `[${awsProfile}]`;
  const leftTopRaw = `${compactName}${idPart}·${region}·${profilePart}`;
  const spinnerWidth = loading ? 1 : 0;
  const topPadLen = Math.max(0, terminalWidth - leftTopRaw.length - watchText.length - spinnerWidth);
  const identityLine = truncateNoPad(currentIdentity || "-", Math.max(1, terminalWidth));
  const identityPadLen = Math.max(0, terminalWidth - identityLine.length);
  const label = ` ${serviceLabel.toUpperCase()} `;
  const tagBadge = tagFilter ? ` 🏷 ${tagFilter.key}=${tagFilter.value}` : "";
  const pathDisplay = ` ${path}${tagBadge} `;
  const padLen = Math.max(0, terminalWidth - label.length - pathDisplay.length);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={theme.hud.accountNameText} bold>
          {compactName}
        </Text>
        <Text color={theme.hud.accountIdText} bold>
          {idPart}
        </Text>
        <Text color={theme.hud.separatorText} bold>
          ·
        </Text>
        <Text color={theme.hud.regionText} bold>
          {region}
        </Text>
        <Text color={theme.hud.separatorText} bold>
          ·
        </Text>
        <Text color={theme.hud.profileText} bold>
          {profilePart}
        </Text>
        <Text>{" ".repeat(topPadLen)}</Text>
        {watchInterval != null ? (
          <Text color={theme.hud.loadingSpinnerText} bold>
            {watchText}
          </Text>
        ) : null}
        {loading ? (
          <Text color={theme.hud.loadingSpinnerText} bold>
            {SPINNER_FRAMES[spinnerIndex]}
          </Text>
        ) : null}
      </Box>
      <Text color={theme.hud.currentIdentityText} wrap="truncate-end">
        {identityLine}
        {" ".repeat(identityPadLen)}
      </Text>
      <Box>
        <Text backgroundColor={hudColor.bg} color={hudColor.fg} bold>
          {label}
        </Text>
        <Text backgroundColor={theme.hud.pathBarBg} color={theme.hud.pathBarText}>
          {pathDisplay}
          {" ".repeat(padLen)}
        </Text>
      </Box>
    </Box>
  );
}
