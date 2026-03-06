/**
 * Closed action-enum: every user-triggerable action has a named constant here.
 * Reference KB.XXX everywhere — never use raw strings like "move_down".
 */
export const KB = {
  // Navigation
  MOVE_DOWN:        "move_down",
  MOVE_UP:          "move_up",
  GO_TOP:           "go_top",          // chord: g g
  GO_BOTTOM:        "go_bottom",       // G
  NAVIGATE_INTO:    "navigate_into",   // Enter
  EDIT:             "edit",            // e
  DETAILS:          "details",         // d
  FETCH:            "fetch",           // f  (S3 only)
  YANK_MODE:        "yank_mode",       // y
  SEARCH_MODE:      "search_mode",     // /
  COMMAND_MODE:     "command_mode",    // :
  REFRESH:          "refresh",         // r
  QUIT:             "quit",            // q
  HELP:             "help",            // ?
  JUMP_TO_PATH:     "jump_to_path",    // chord: g p  (S3 only)

  // Picker
  PICKER_UP:        "picker_up",
  PICKER_DOWN:      "picker_down",
  PICKER_FILTER:    "picker_filter",
  PICKER_CONFIRM:   "picker_confirm",
  PICKER_CLOSE:     "picker_close",
  PICKER_TOP:       "picker_top",      // chord: g g
  PICKER_BOTTOM:    "picker_bottom",   // G

  // Help panel
  HELP_PREV_TAB:    "help_prev_tab",
  HELP_NEXT_TAB:    "help_next_tab",
  HELP_SCROLL_UP:   "help_scroll_up",
  HELP_SCROLL_DOWN: "help_scroll_down",
  HELP_CLOSE:       "help_close",
} as const;

export type KeyAction = typeof KB[keyof typeof KB];
