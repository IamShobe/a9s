import React, { useEffect, useMemo, useState } from "react";
import { Text, useInput } from "ink";
import type { Key } from "ink";

export interface AdvancedTextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  focus?: boolean;
  cursorToEndToken?: number;
}

type WordDirection = "left" | "right";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function isWordChar(char: string): boolean {
  return /[A-Za-z0-9_]/.test(char);
}

export function moveCursorWordLeft(text: string, cursor: number): number {
  let i = clamp(cursor, 0, text.length);
  while (i > 0 && !isWordChar(text[i - 1] ?? "")) i -= 1;
  while (i > 0 && isWordChar(text[i - 1] ?? "")) i -= 1;
  return i;
}

export function moveCursorWordRight(text: string, cursor: number): number {
  let i = clamp(cursor, 0, text.length);
  while (i < text.length && !isWordChar(text[i] ?? "")) i += 1;
  while (i < text.length && isWordChar(text[i] ?? "")) i += 1;
  return i;
}

export function decodeAltWordDirection(input: string, key: Key): WordDirection | null {
  if (key.meta && key.leftArrow) return "left";
  if (key.meta && key.rightArrow) return "right";

  // Fallbacks used by various terminals for Alt/Option+Left/Right.
  if (input === "\u001bb") return "left";
  if (input === "\u001bf") return "right";
  if (input === "\u001b[1;3D" || input === "\u001b[1;9D") return "left";
  if (input === "\u001b[1;3C" || input === "\u001b[1;9C") return "right";

  return null;
}

export interface TextEditResult {
  value: string;
  cursor: number;
  submit: boolean;
  handled: boolean;
}

function isBackspaceSignal(input: string, key: Key): boolean {
  // Don't match Alt+Backspace sequences (they start with ESC)
  if (input.startsWith("\u001b")) return false;
  // Accept delete key without meta as backspace (some terminals report backspace as delete)
  return key.backspace || input === "\u0008" || input === "\u007f" || (key.delete && !key.meta && input === "");
}

function isDeleteSignal(input: string, key: Key): boolean {
  return input === "\u001b[3~";
}

export function isAltBackspaceSignal(input: string, key: Key): boolean {
  // Ink interprets Alt+Backspace as Alt+Delete
  if (key.meta && key.delete) {
    return true;
  }

  if (key.meta && key.backspace) {
    return true;
  }

  // Fallback for Alt+Backspace sequences in various terminals
  if (input === "\u001b\u007f") return true;   // ESC+DEL
  if (input === "\u001b\u0008") return true;   // ESC+BS
  if (input === "\u001b[3;3~") return true;    // Alt+Del variant
  if (input === "\u001b[127") return true;     // ESC+127
  if (input === "\u001bDEL") return true;      // ESC+literal DEL

  return false;
}

export function applyAdvancedInputEdit(
  currentValue: string,
  currentCursor: number,
  input: string,
  key: Key,
): TextEditResult {
  const cursor = clamp(currentCursor, 0, currentValue.length);

  if (key.return) {
    return { value: currentValue, cursor, submit: true, handled: true };
  }

  const wordDirection = decodeAltWordDirection(input, key);
  if (wordDirection === "left") {
    return {
      value: currentValue,
      cursor: moveCursorWordLeft(currentValue, cursor),
      submit: false,
      handled: true,
    };
  }
  if (wordDirection === "right") {
    return {
      value: currentValue,
      cursor: moveCursorWordRight(currentValue, cursor),
      submit: false,
      handled: true,
    };
  }

  if (key.leftArrow) {
    return { value: currentValue, cursor: Math.max(0, cursor - 1), submit: false, handled: true };
  }

  if (key.rightArrow) {
    return {
      value: currentValue,
      cursor: Math.min(currentValue.length, cursor + 1),
      submit: false,
      handled: true,
    };
  }

  if (key.home) {
    return { value: currentValue, cursor: 0, submit: false, handled: true };
  }

  if (key.end) {
    return { value: currentValue, cursor: currentValue.length, submit: false, handled: true };
  }

  // Check Alt+Backspace first (before regular Backspace) since both use backspace flag
  if (isAltBackspaceSignal(input, key)) {
    if (cursor <= 0) return { value: currentValue, cursor, submit: false, handled: true };
    const wordStart = moveCursorWordLeft(currentValue, cursor);
    const next = currentValue.slice(0, wordStart) + currentValue.slice(cursor);
    return { value: next, cursor: wordStart, submit: false, handled: true };
  }

  if (isBackspaceSignal(input, key)) {
    if (cursor <= 0) return { value: currentValue, cursor, submit: false, handled: true };
    const next = currentValue.slice(0, cursor - 1) + currentValue.slice(cursor);
    return { value: next, cursor: cursor - 1, submit: false, handled: true };
  }

  if (isDeleteSignal(input, key)) {
    if (cursor >= currentValue.length) {
      return { value: currentValue, cursor, submit: false, handled: true };
    }
    const next = currentValue.slice(0, cursor) + currentValue.slice(cursor + 1);
    return { value: next, cursor, submit: false, handled: true };
  }

  if (key.ctrl || key.meta || key.escape || key.tab) {
    return { value: currentValue, cursor, submit: false, handled: false };
  }

  if (!input) {
    return { value: currentValue, cursor, submit: false, handled: false };
  }

  // Ignore control escape-sequences or other non-printable input.
  if (input.length > 1 || /[\u0000-\u001f\u007f]/.test(input)) {
    return { value: currentValue, cursor, submit: false, handled: false };
  }

  const next = currentValue.slice(0, cursor) + input + currentValue.slice(cursor);
  return {
    value: next,
    cursor: cursor + input.length,
    submit: false,
    handled: true,
  };
}

export function AdvancedTextInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  focus = true,
  cursorToEndToken,
}: AdvancedTextInputProps) {
  const [cursor, setCursor] = useState(value.length);

  useEffect(() => {
    setCursor((prev) => clamp(prev, 0, value.length));
  }, [value]);

  useEffect(() => {
    if (cursorToEndToken === undefined) return;
    setCursor(value.length);
  }, [cursorToEndToken, value.length]);

  useInput(
    (input, key) => {
      if (!focus) return;

      const result = applyAdvancedInputEdit(value, cursor, input, key);

      if (!result.handled) return;

      if (result.value !== value) {
        onChange(result.value);
      }
      if (result.cursor !== cursor) {
        setCursor(result.cursor);
      }
      if (result.submit) {
        onSubmit();
      }
    },
    { isActive: focus },
  );

  const rendered = useMemo(() => {
    if (value.length === 0) {
      return { isPlaceholder: true, text: placeholder ?? "" };
    }

    const safeCursor = clamp(cursor, 0, value.length);
    const before = value.slice(0, safeCursor);
    const at = safeCursor < value.length ? value[safeCursor] : " ";
    const after = value.slice(Math.min(value.length, safeCursor + 1));

    return {
      isPlaceholder: false,
      before,
      at,
      after,
    };
  }, [cursor, placeholder, value]);

  if (rendered.isPlaceholder) {
    return <Text color="gray">{rendered.text}</Text>;
  }

  return (
    <Text>
      {rendered.before}
      <Text inverse>{rendered.at}</Text>
      {rendered.after}
    </Text>
  );
}
