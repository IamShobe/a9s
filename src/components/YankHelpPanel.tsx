import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import type { YankOption } from "../adapters/capabilities/YankCapability.js";
import { triggerToString } from "../constants/keybindings.js";
import type { TableRow } from "../types.js";
import { useTheme } from "../contexts/ThemeContext.js";

interface YankHelpPanelProps {
  options: YankOption[];
  row: TableRow | null;
}

export function YankHelpPanel({ options, row }: YankHelpPanelProps) {
  const theme = useTheme();
  const [resolvedValues, setResolvedValues] = useState<Record<string, string>>({});

  useEffect(() => {
    let isActive = true;

    if (!row) {
      setResolvedValues({});
      return () => {
        isActive = false;
      };
    }

    const load = async () => {
      const entries = await Promise.all(
        options.map(async (option) => {
          const id = `${option.label}-${triggerToString(option.trigger)}`;
          try {
            const value = await option.resolve(row);
            return [id, value ?? "(empty)"] as const;
          } catch (error) {
            return [id, `(error: ${(error as Error).message})`] as const;
          }
        }),
      );

      if (!isActive) return;
      const next: Record<string, string> = {};
      for (const [id, value] of entries) {
        next[id] = value;
      }
      setResolvedValues(next);
    };

    void load();

    return () => {
      isActive = false;
    };
  }, [options, row]);

  const MAX_VALUE_LEN = 45;

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0} flexGrow={1}>
      <Box gap={2}>
        <Text bold color={theme.panel.panelTitleText}>Yank</Text>
        <Text color={theme.panel.panelDividerText}>Press key to copy · Esc to close</Text>
      </Box>
      <Text color={theme.panel.panelDividerText}>{"─".repeat(36)}</Text>
      {!row && <Text color={theme.error.errorTitleText}>No row selected</Text>}
      {options.map((option) => {
        const id = `${option.label}-${triggerToString(option.trigger)}`;
        const raw = resolvedValues[id];
        const displayValue = row
          ? raw != null
            ? raw.length > MAX_VALUE_LEN
              ? raw.slice(0, MAX_VALUE_LEN - 1) + "…"
              : raw
            : "(loading…)"
          : "(no value)";
        return (
          <Box key={id}>
            <Text color={theme.panel.keyText} bold>{triggerToString(option.trigger).padEnd(5)}</Text>
            <Text color={theme.panel.panelHintText}>{option.label.padEnd(16)}</Text>
            <Text color={theme.panel.panelDividerText}>{"→ "}</Text>
            <Text>{displayValue}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
