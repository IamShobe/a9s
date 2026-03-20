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
  | { type: "delete" }
  | { type: "none" };

export function resolvePickerScopeAction(
  input: string,
  key: Key,
  pickerMode: "navigate" | "search",
  action: KeyAction | null,
  activePickerId: string | null,
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
      // d key deletes selected item (only for bookmarks picker)
      if (pickerMode === "navigate" && activePickerId === "bookmarks" && input === "d") {
        return { type: "delete" };
      }
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
  | { type: "relatedResources" }
  | { type: "openInBrowser" }
  | { type: "sortColumn" }
  | { type: "heatmapToggle" }
  | { type: "multiSelectToggle" }
  | { type: "multiSelectRange" }
  | { type: "multiSelectAll" }
  | { type: "bookmarkToggle" }
  | { type: "showHistogram" }
  | { type: "previewFile" }
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
    case KB.RELATED_RESOURCES:
      return { type: "relatedResources" };
    case KB.OPEN_IN_BROWSER:
      return { type: "openInBrowser" };
    case KB.SORT_COLUMN:
      return { type: "sortColumn" };
    case KB.HEATMAP_TOGGLE:
      return { type: "heatmapToggle" };
    case KB.MULTI_SELECT_TOGGLE:
      return { type: "multiSelectToggle" };
    case KB.MULTI_SELECT_RANGE:
      return { type: "multiSelectRange" };
    case KB.MULTI_SELECT_ALL:
      return { type: "multiSelectAll" };
    case KB.BOOKMARK_TOGGLE:
      return { type: "bookmarkToggle" };
    case KB.HISTOGRAM:
      return { type: "showHistogram" };
    case KB.PREVIEW_FILE:
      return { type: "previewFile" };
    default:
      return { type: "none" };
  }
}
