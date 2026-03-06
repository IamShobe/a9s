import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { Alert, Badge, StatusMessage, UnorderedList } from "@inkjs/ui";
import type { YankOption } from "../adapters/capabilities/YankCapability.js";
import { triggerToString } from "../constants/keybindings.js";
import type { TableRow } from "../types.js";

interface YankHelpPanelProps {
  options: YankOption[];
  row: TableRow | null;
}

export function YankHelpPanel({ options, row }: YankHelpPanelProps) {
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

  return (
    <Box flexDirection="column" paddingX={1}>
      <Alert variant="info" title="Yank Options">
        Press key to copy, Esc or ? to close
      </Alert>
      <Box height={1} />
      {!row && <StatusMessage variant="warning">No row selected</StatusMessage>}
      <UnorderedList>
        {options.map((option) => (
          <UnorderedList.Item key={`${option.label}-${triggerToString(option.trigger)}`}>
            <Box flexDirection="column">
              <Box>
                <Badge color="yellow">{triggerToString(option.trigger)}</Badge>
                <Text> {option.label}</Text>
              </Box>
              <Text color="gray">
                {row
                  ? `  -> ${resolvedValues[`${option.label}-${triggerToString(option.trigger)}`] ?? "(loading...)"}`
                  : "  -> (no value)"}
              </Text>
            </Box>
          </UnorderedList.Item>
        ))}
      </UnorderedList>
    </Box>
  );
}
