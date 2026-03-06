import React, { useMemo, useRef } from "react";
import { Box, Text } from "ink";
import type { AppMode } from "../types.js";
import {
  AutocompleteInput,
  type AutocompleteInputHandle,
} from "./AutocompleteInput.js";

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

const MODE_HINTS: Record<AppMode, string> = {
  navigate:
    " j/k ↑↓ move  •  Enter select  •  / search  •  : command  •  Esc/q back/quit",
  search: " Type to filter  •  Esc cancel  •  Enter confirm",
  command: " Commands: s3 route53 dynamodb iam quit  •  Esc cancel",
};

const AVAILABLE_COMMANDS = [
  "s3",
  "route53",
  "dynamodb",
  "iam",
  "regions",
  "profiles",
  "resources",
  "region",
  "profile",
  "use-region",
  "use-profile",
  "$default",
  "quit",
];

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
            <Text color="gray" wrap="truncate-end">{hintOverride ?? MODE_HINTS.navigate}</Text>
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
              suggestions={AVAILABLE_COMMANDS}
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
