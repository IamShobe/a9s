import React, { useRef } from "react";
import { Box, Text } from "ink";
import type { AppMode } from "../types.js";
import {
  AutocompleteInput,
  type AutocompleteInputHandle,
} from "./AutocompleteInput.js";
import { AVAILABLE_COMMANDS } from "../constants/commands.js";

interface ModeBarProps {
  mode: AppMode;
  filterText: string;
  commandText: string;
  commandCursorToEndToken?: number;
  hintOverride?: string;
  onFilterChange: (value: string) => void;
  onCommandChange: (value: string) => void;
  onFilterSubmit: () => void;
  onCommandSubmit: () => void;
  onCommandAutocomplete?: () => void;
  onFilterAutocomplete?: () => void;
}

const MODE_ICONS: Record<AppMode, string> = {
  navigate: "◉",
  search: "/",
  command: ":",
};

const MODE_COLORS: Record<AppMode, string> = {
  navigate: "blue",
  search: "blue",
  command: "blue",
};

export const ModeBar = React.forwardRef<
  {
    commandInput?: AutocompleteInputHandle;
    filterInput?: AutocompleteInputHandle;
  },
  ModeBarProps
>(
  (
    {
      mode,
      filterText,
      commandText,
      commandCursorToEndToken,
      hintOverride,
      onFilterChange,
      onCommandChange,
      onFilterSubmit,
      onCommandSubmit,
      onCommandAutocomplete,
      onFilterAutocomplete,
    },
    ref,
  ) => {
    const commandInputRef = useRef<AutocompleteInputHandle>(null);
    const filterInputRef = useRef<AutocompleteInputHandle>(null);

    const renderHint = (hint: string) => {
      const entries = hint
        .trim()
        .split("•")
        .map((x) => x.trim())
        .filter(Boolean);

      return (
        <Text color="gray" wrap="truncate-end">
          {entries.map((entry, idx) => {
            const [rawKey, rawDesc] = entry.split("·").map((x) => x.trim());
            const keyPart = rawKey ?? entry;
            const descPart = rawDesc ?? "";

            return (
              <React.Fragment key={`hint-${idx}`}>
                <Text color="yellow">{keyPart}</Text>
                {descPart ? <Text color="gray"> {descPart}</Text> : null}
                {idx < entries.length - 1 ? <Text color="gray"> • </Text> : null}
              </React.Fragment>
            );
          })}
        </Text>
      );
    };

    React.useImperativeHandle(ref, () => ({
      commandInput: commandInputRef.current ?? ({} as AutocompleteInputHandle),
      filterInput: filterInputRef.current ?? ({} as AutocompleteInputHandle),
    }));

    return (
      <Box flexDirection="column" width="100%">
        <Box paddingX={1}>
          <Text color={MODE_COLORS[mode]} bold>
            {MODE_ICONS[mode]}
          </Text>
          <Text> </Text>
          {mode === "navigate" && (
            renderHint(hintOverride ?? "")
          )}
          {mode === "search" && (
            <AutocompleteInput
              ref={filterInputRef}
              value={filterText}
              onChange={onFilterChange}
              onSubmit={onFilterSubmit}
              placeholder={"Type to filter"}
              focus={mode === "search"}
            />
          )}
          {mode === "command" && (
            <AutocompleteInput
              ref={commandInputRef}
              value={commandText}
              onChange={onCommandChange}
              onSubmit={onCommandSubmit}
              placeholder={"Type a command"}
              suggestions={[...AVAILABLE_COMMANDS]}
              focus={mode === "command"}
              {...(commandCursorToEndToken !== undefined
                ? { cursorToEndToken: commandCursorToEndToken }
                : {})}
            />
          )}
        </Box>
      </Box>
    );
  },
);
