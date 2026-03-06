import React, { useEffect, useImperativeHandle, useMemo, useState } from "react";
import { Box, Text } from "ink";
import { AdvancedTextInput } from "./AdvancedTextInput.js";
import { useTheme } from "../contexts/ThemeContext.js";

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

export const AutocompleteInput = React.forwardRef<AutocompleteInputHandle, AutocompleteInputProps>(
  (
    { value, onChange, onSubmit, placeholder, suggestions = [], focus = true, cursorToEndToken },
    ref,
  ) => {
    const THEME = useTheme();
    const [inputKey, setInputKey] = useState(0);

    const matchingSuggestions = useMemo(() => {
      if (!value || suggestions.length === 0) return [];
      return suggestions.filter((s) => s.toLowerCase().startsWith(value.toLowerCase()));
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
        <AdvancedTextInput
          key={`autocomplete-input-${inputKey}`}
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder={placeholder}
          focus={focus}
          {...(cursorToEndToken !== undefined ? { cursorToEndToken } : {})}
        />
        {suggestion && (
          <Text color={THEME.input.suggestionText} dimColor>
            {suggestion}
          </Text>
        )}
      </Box>
    );
  },
);
