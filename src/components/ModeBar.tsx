import React, { useMemo, useRef } from 'react';
import { Box, Text } from 'ink';
import type { AppMode } from '../types.js';
import { AutocompleteInput, type AutocompleteInputHandle } from './AutocompleteInput.js';

interface ModeBarProps {
  mode: AppMode;
  filterText: string;
  commandText: string;
  onFilterChange: (value: string) => void;
  onCommandChange: (value: string) => void;
  onFilterSubmit: () => void;
  onCommandSubmit: () => void;
  onCommandAutocomplete?: () => void;
  onFilterAutocomplete?: () => void;
}

const MODE_ICONS: Record<AppMode, string> = {
  navigate: '◉',
  search: '/',
  command: ':',
};

const MODE_COLORS: Record<AppMode, string> = {
  navigate: 'blue',
  search: 'blue',
  command: 'blue',
};

const MODE_HINTS: Record<AppMode, string> = {
  navigate: ' j/k ↑↓ move  •  Enter select  •  / search  •  : command  •  Esc/q back/quit',
  search: ' Type to filter  •  Esc cancel  •  Enter confirm',
  command: ' Commands: s3 route53 dynamodb quit  •  Esc cancel',
};

const AVAILABLE_COMMANDS = ['s3', 'route53', 'dynamodb', 'quit'];

export const ModeBar = React.forwardRef<
  { commandInput?: AutocompleteInputHandle; filterInput?: AutocompleteInputHandle },
  ModeBarProps
>(
  (
    {
      mode,
      filterText,
      commandText,
      onFilterChange,
      onCommandChange,
      onFilterSubmit,
      onCommandSubmit,
      onCommandAutocomplete,
      onFilterAutocomplete,
    },
    ref
  ) => {
    const commandInputRef = useRef<AutocompleteInputHandle>(null);
    const filterInputRef = useRef<AutocompleteInputHandle>(null);

    React.useImperativeHandle(ref, () => ({
      commandInput: commandInputRef.current || undefined,
      filterInput: filterInputRef.current || undefined,
    }));

    return (
      <Box flexDirection="column" width="100%">
        <Box paddingX={1} paddingTop={1}>
          <Text color={MODE_COLORS[mode]} bold>
            {MODE_ICONS[mode]}
          </Text>
          <Text>  </Text>
          {mode === 'navigate' && <Text color="gray">{MODE_HINTS.navigate}</Text>}
          {mode === 'search' && (
            <AutocompleteInput
              ref={filterInputRef}
              value={filterText}
              onChange={onFilterChange}
              onSubmit={onFilterSubmit}
              focus
            />
          )}
          {mode === 'command' && (
            <AutocompleteInput
              ref={commandInputRef}
              value={commandText}
              onChange={onCommandChange}
              onSubmit={onCommandSubmit}
              suggestions={AVAILABLE_COMMANDS}
              focus
            />
          )}
        </Box>
      </Box>
    );
  }
);
