import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

export interface AutocompleteInputHandle {
  autocomplete: () => void;
}

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  suggestions?: string[];
  focus?: boolean;
  cursorToEndToken?: number;
}

export const AutocompleteInput = React.forwardRef<
  AutocompleteInputHandle,
  AutocompleteInputProps
>(
  (
    {
      value,
      onChange,
      onSubmit,
      placeholder,
      suggestions = [],
      focus = true,
      cursorToEndToken,
    },
    ref,
  ) => {
    const [inputKey, setInputKey] = useState(0);

    const matchingSuggestions = useMemo(() => {
      if (!value || suggestions.length === 0) return [];
      return suggestions.filter((s) =>
        s.toLowerCase().startsWith(value.toLowerCase()),
      );
    }, [value, suggestions]);

    const firstMatch = matchingSuggestions[0];
    const suggestion = firstMatch ? firstMatch.slice(value.length) : "";

    useImperativeHandle(ref, () => ({
      autocomplete: () => {
        if (firstMatch && firstMatch !== value) {
          onChange(firstMatch);
          // Remount input to move cursor to end
          setInputKey((k) => k + 1);
        }
      },
    }));

    useEffect(() => {
      if (cursorToEndToken === undefined) return;
      setInputKey((k) => k + 1);
    }, [cursorToEndToken]);

    return (
      <Box>
        <TextInput
          key={`autocomplete-input-${inputKey}`}
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder={placeholder}
          focus={focus}
        />
        {suggestion && (
          <Text color="gray" dimColor>
            {suggestion}
          </Text>
        )}
      </Box>
    );
  },
);
