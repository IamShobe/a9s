import type { Key } from "ink";
import { KB } from "../constants/keys.js";
import type { KeyAction } from "../constants/keys.js";

export type HelpScopeAction =
  | { type: "close" }
  | { type: "prevTab" }
  | { type: "nextTab" }
  | { type: "scrollUp" }
  | { type: "scrollDown" }
  | { type: "goToTab"; input: string }
  | { type: "none" };

export function resolveHelpScopeAction(input: string, action: KeyAction | null): HelpScopeAction {
  switch (action) {
    case KB.HELP_CLOSE:
      return { type: "close" };
    case KB.HELP_PREV_TAB:
      return { type: "prevTab" };
    case KB.HELP_NEXT_TAB:
      return { type: "nextTab" };
    case KB.HELP_SCROLL_UP:
      return { type: "scrollUp" };
    case KB.HELP_SCROLL_DOWN:
      return { type: "scrollDown" };
    default:
      return /^[1-9]$/.test(input) ? { type: "goToTab", input } : { type: "none" };
  }
}

export type PickerScopeAction =
  | { type: "consume" }
  | { type: "close" }
  | { type: "search" }
  | { type: "down" }
  | { type: "up" }
  | { type: "top" }
  | { type: "bottom" }
  | { type: "confirm" }
  | { type: "none" };

export function resolvePickerScopeAction(
  key: Key,
  pickerMode: "navigate" | "search",
  action: KeyAction | null,
): PickerScopeAction {
  if (pickerMode === "search" && !key.escape) {
    return { type: "consume" };
  }

  switch (action) {
    case KB.PICKER_CLOSE:
      return { type: "close" };
    case KB.PICKER_FILTER:
      return { type: "search" };
    case KB.PICKER_DOWN:
      return { type: "down" };
    case KB.PICKER_UP:
      return { type: "up" };
    case KB.PICKER_TOP:
      return { type: "top" };
    case KB.PICKER_BOTTOM:
      return { type: "bottom" };
    case KB.PICKER_CONFIRM:
      return { type: "confirm" };
    default:
      return { type: "none" };
  }
}

export type NavigateScopeAction =
  | { type: "search" }
  | { type: "command" }
  | { type: "quit" }
  | { type: "refresh" }
  | { type: "reveal" }
  | { type: "yank" }
  | { type: "details" }
  | { type: "edit" }
  | { type: "bottom" }
  | { type: "top" }
  | { type: "enter" }
  | { type: "none" };

export function resolveNavigateScopeAction(action: KeyAction | null): NavigateScopeAction {
  switch (action) {
    case KB.SEARCH_MODE:
      return { type: "search" };
    case KB.COMMAND_MODE:
      return { type: "command" };
    case KB.QUIT:
      return { type: "quit" };
    case KB.REFRESH:
      return { type: "refresh" };
    case KB.REVEAL_TOGGLE:
      return { type: "reveal" };
    case KB.YANK_MODE:
      return { type: "yank" };
    case KB.DETAILS:
      return { type: "details" };
    case KB.EDIT:
      return { type: "edit" };
    case KB.GO_BOTTOM:
      return { type: "bottom" };
    case KB.GO_TOP:
      return { type: "top" };
    case KB.NAVIGATE_INTO:
      return { type: "enter" };
    default:
      return { type: "none" };
  }
}
