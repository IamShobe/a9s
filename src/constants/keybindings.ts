import type { HelpItem, HelpTab } from "../components/HelpPanel.js";
import { KB } from "./keys.js";
import type { KeyAction } from "./keys.js";
import type { AdapterKeyBinding } from "../adapters/capabilities/ActionCapability.js";

// ---------------------------------------------------------------------------
// Trigger types — describe both how to match a key press AND how to display it
// ---------------------------------------------------------------------------

export type SpecialKeyName =
  | "return"
  | "escape"
  | "tab"
  | "upArrow"
  | "downArrow"
  | "leftArrow"
  | "rightArrow";

export type KeyTrigger =
  | { type: "key"; char: string }           // single printable char e.g. "j"
  | { type: "special"; name: SpecialKeyName }
  | { type: "chord"; keys: string[] }       // sequence of chars e.g. ["g","g"]
  | { type: "any"; of: KeyTrigger[] };      // matches any of the sub-triggers

/** Convert a trigger to a human-readable display string */
export function triggerToString(t: KeyTrigger): string {
  switch (t.type) {
    case "key":     return t.char;
    case "special": return SPECIAL_DISPLAY[t.name];
    case "chord":   return t.keys.join(" ");
    case "any":     return t.of.map(triggerToString).join(" / ");
  }
}

const SPECIAL_DISPLAY: Record<SpecialKeyName, string> = {
  return:     "Enter",
  escape:     "Esc",
  tab:        "Tab",
  upArrow:    "↑",
  downArrow:  "↓",
  leftArrow:  "←",
  rightArrow: "→",
};

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

export type KeyScope =
  | "navigate"
  | "search"
  | "command"
  | "yank"
  | "details"
  | "upload"
  | "picker"
  | "help";

const SCOPE_LABELS: Record<KeyScope, string> = {
  navigate: "Navigate",
  search:   "Search",
  command:  "Command",
  yank:     "Yank",
  details:  "Details",
  upload:   "Upload",
  picker:   "Pickers",
  help:     "Help Panel",
};

// ---------------------------------------------------------------------------
// KeyBinding
// ---------------------------------------------------------------------------

export interface KeyBinding {
  action: KeyAction;
  trigger: KeyTrigger;
  scope: KeyScope;
  label: string; // help panel description
}

// ---------------------------------------------------------------------------
// Registry — THE single source of truth for every keybinding
// ---------------------------------------------------------------------------

const j_down: KeyTrigger = { type: "any", of: [{ type: "key", char: "j" }, { type: "special", name: "downArrow" }] };
const k_up:   KeyTrigger = { type: "any", of: [{ type: "key", char: "k" }, { type: "special", name: "upArrow"   }] };

export const KEYBINDINGS: KeyBinding[] = [
  // --- Navigate ---
  { action: KB.MOVE_DOWN,     trigger: j_down,                                     scope: "navigate", label: "Move selection down" },
  { action: KB.MOVE_UP,       trigger: k_up,                                       scope: "navigate", label: "Move selection up" },
  { action: KB.GO_TOP,        trigger: { type: "chord", keys: ["g", "g"] },        scope: "navigate", label: "Jump to top" },
  { action: KB.GO_BOTTOM,     trigger: { type: "key", char: "G" },                 scope: "navigate", label: "Jump to bottom" },
  { action: KB.NAVIGATE_INTO, trigger: { type: "special", name: "return" },        scope: "navigate", label: "Open bucket/folder" },
  { action: KB.EDIT,          trigger: { type: "key", char: "e" },                 scope: "navigate", label: "Edit selected item" },
  { action: KB.DETAILS,       trigger: { type: "key", char: "d" },                 scope: "navigate", label: "Open details panel" },
  { action: KB.YANK_MODE,     trigger: { type: "key", char: "y" },                 scope: "navigate", label: "Open yank mode" },
  { action: KB.SEARCH_MODE,   trigger: { type: "key", char: "/" },                 scope: "navigate", label: "Search mode" },
  { action: KB.COMMAND_MODE,  trigger: { type: "key", char: ":" },                 scope: "navigate", label: "Command mode" },
  { action: KB.REFRESH,       trigger: { type: "key", char: "r" },                 scope: "navigate", label: "Refresh" },
  { action: KB.QUIT,          trigger: { type: "key", char: "q" },                 scope: "navigate", label: "Quit" },
  { action: KB.HELP,          trigger: { type: "key", char: "?" },                 scope: "navigate", label: "Open help (navigate mode only)" },

  // --- Search (informational — text input handles actual typing) ---
  { action: KB.SEARCH_MODE,   trigger: { type: "key", char: "/" },                 scope: "search",  label: "Open: press / in navigate mode" },
  { action: KB.NAVIGATE_INTO, trigger: { type: "special", name: "return" },        scope: "search",  label: "Apply filter and return to navigate" },
  { action: KB.QUIT,          trigger: { type: "special", name: "escape" },        scope: "search",  label: "Cancel and restore previous filter" },

  // --- Command (informational) ---
  { action: KB.COMMAND_MODE,  trigger: { type: "key", char: ":" },                 scope: "command", label: "Open: press : in navigate mode" },
  { action: KB.NAVIGATE_INTO, trigger: { type: "special", name: "return" },        scope: "command", label: "Run command" },
  { action: KB.QUIT,          trigger: { type: "special", name: "escape" },        scope: "command", label: "Cancel command mode" },

  // --- Yank (informational — actual options come from adapter.capabilities?.yank?.getYankOptions) ---
  { action: KB.YANK_MODE,     trigger: { type: "key", char: "y" },                 scope: "yank",   label: "Open: press y in navigate mode" },
  { action: KB.YANK_MODE,     trigger: { type: "key", char: "n" },                 scope: "yank",   label: "Copy selected name" },
  { action: KB.YANK_MODE,     trigger: { type: "key", char: "a" },                 scope: "yank",   label: "Copy ARN (when available)" },
  { action: KB.QUIT,          trigger: { type: "special", name: "escape" },        scope: "yank",   label: "Cancel yank mode" },

  // --- Details (informational) ---
  { action: KB.DETAILS,       trigger: { type: "key", char: "d" },                 scope: "details", label: "Open: press d in navigate mode" },
  { action: KB.QUIT,          trigger: { type: "special", name: "escape" },        scope: "details", label: "Close details panel" },

  // --- Upload (informational) ---
  { action: KB.YANK_MODE,     trigger: { type: "key", char: "y" },                 scope: "upload", label: "Upload edited file" },
  { action: KB.QUIT,          trigger: { type: "any", of: [{ type:"key", char:"n" }, { type:"special", name:"escape" }] }, scope: "upload", label: "Cancel upload" },

  // --- Picker ---
  { action: KB.PICKER_DOWN,   trigger: j_down,                                     scope: "picker", label: "Move down" },
  { action: KB.PICKER_UP,     trigger: k_up,                                       scope: "picker", label: "Move up" },
  { action: KB.PICKER_TOP,    trigger: { type: "chord", keys: ["g", "g"] },        scope: "picker", label: "Jump to top" },
  { action: KB.PICKER_BOTTOM, trigger: { type: "key", char: "G" },                 scope: "picker", label: "Jump to bottom" },
  { action: KB.PICKER_FILTER, trigger: { type: "key", char: "/" },                 scope: "picker", label: "Filter" },
  { action: KB.PICKER_CONFIRM,trigger: { type: "special", name: "return" },        scope: "picker", label: "Confirm selection" },
  { action: KB.PICKER_CLOSE,  trigger: { type: "special", name: "escape" },        scope: "picker", label: "Close" },

  // --- Help panel ---
  { action: KB.HELP_PREV_TAB,    trigger: { type: "any", of: [{ type:"key", char:"h" }, { type:"special", name:"leftArrow"  }] }, scope: "help", label: "Previous tab" },
  { action: KB.HELP_NEXT_TAB,    trigger: { type: "any", of: [{ type:"key", char:"l" }, { type:"special", name:"rightArrow" }] }, scope: "help", label: "Next tab" },
  { action: KB.HELP_SCROLL_UP,   trigger: k_up,                                     scope: "help", label: "Scroll up" },
  { action: KB.HELP_SCROLL_DOWN, trigger: j_down,                                   scope: "help", label: "Scroll down" },
  { action: KB.HELP_CLOSE,       trigger: { type: "any", of: [{ type:"key", char:"?" }, { type:"special", name:"escape" }] }, scope: "help", label: "Close help" },
];

// ---------------------------------------------------------------------------
// Help panel derivation
// ---------------------------------------------------------------------------

const SCOPE_ORDER: KeyScope[] = [
  "navigate",
  "search",
  "command",
  "yank",
  "details",
  "upload",
  "picker",
  "help",
];

/**
 * Build HelpPanel tabs from KEYBINDINGS and adapter-specific bindings.
 * Display key is automatically derived from each binding's trigger.
 */
export function buildHelpTabs(
  adapterId?: string,
  adapterBindings?: AdapterKeyBinding[],
): HelpTab[] {
  const groups = new Map<KeyScope, HelpItem[]>();

  for (const kb of KEYBINDINGS) {
    if (!groups.has(kb.scope)) groups.set(kb.scope, []);
    groups.get(kb.scope)!.push({
      key: triggerToString(kb.trigger),
      description: kb.label,
    });
  }

  // Add adapter-specific bindings
  if (adapterBindings) {
    for (const ab of adapterBindings) {
      const scope = ab.scope || "navigate";
      if (!groups.has(scope)) groups.set(scope, []);
      groups.get(scope)!.push({
        key: triggerToString(ab.trigger),
        description: ab.label,
      });
    }
  }

  // De-duplicate entries with identical key+description within the same scope
  // (e.g. search/command/yank open entries share action with navigate entries)
  for (const [scope, items] of groups) {
    const seen = new Set<string>();
    groups.set(
      scope,
      items.filter((item) => {
        const key = `${item.key}|${item.description}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    );
  }

  return SCOPE_ORDER.filter((s) => groups.has(s)).map((s) => ({
    title: SCOPE_LABELS[s],
    items: groups.get(s)!,
  }));
}

/** Derive the navigate mode hint string from KEYBINDINGS */
export function buildNavigateHint(): string {
  const navigateKeys = KEYBINDINGS.filter((kb) => kb.scope === "navigate");
  return (
    " " +
    navigateKeys
      .slice(0, 6)
      .map((kb) => `${triggerToString(kb.trigger)} ${kb.label.toLowerCase()}`)
      .join("  •  ")
  );
}

/** Generic bottom-hint builder for a given scope, derived from KEYBINDINGS and adapter bindings. */
export function buildScopeHint(
  scope: KeyScope,
  adapterBindings?: AdapterKeyBinding[],
  maxItems = 8,
): string {
  const filtered = KEYBINDINGS.filter((kb) => kb.scope === scope);

  const seen = new Set<string>();
  const compact = filtered.filter((kb) => {
    const key = `${kb.action}|${triggerToString(kb.trigger)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Add adapter-specific bindings
  const adapterItems: Array<{ trigger: KeyTrigger; label: string }> = [];
  if (adapterBindings) {
    for (const ab of adapterBindings) {
      if ((ab.scope || "navigate") === scope) {
        const key = `${ab.actionId}|${triggerToString(ab.trigger)}`;
        if (!seen.has(key)) {
          seen.add(key);
          adapterItems.push({ trigger: ab.trigger, label: ab.label });
        }
      }
    }
  }

  const shortLabel = (label: string): string =>
    label
      .replace(/^Open:\s*/i, "")
      .replace(/\(navigate mode only\)/gi, "")
      .replace(/^Move selection /i, "")
      .replace(/^Jump to /i, "")
      .replace(/^Open /i, "")
      .replace(/^Apply filter and /i, "")
      .replace(/^Cancel and /i, "")
      .replace(/^Copy selected /i, "copy ")
      .replace(/^Copy /i, "copy ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  let ordered: Array<{ trigger: KeyTrigger; label: string }> = [
    ...compact,
    ...adapterItems,
  ];

  if (scope === "navigate") {
    const priority: KeyAction[] = [
      KB.MOVE_DOWN,
      KB.MOVE_UP,
      KB.SEARCH_MODE,
      KB.HELP,
    ];
    const priorityItems = priority
      .map((action) => compact.find((kb) => kb.action === action))
      .filter((kb): kb is KeyBinding => Boolean(kb));
    const restItems = compact.filter((kb) => !priority.includes(kb.action));
    ordered = [...priorityItems, ...restItems, ...adapterItems];
  }

  const parts = ordered.slice(0, maxItems).map((item) => {
    const label = shortLabel(item.label);
    return `${triggerToString(item.trigger)} · ${label}`;
  });

  return parts.length > 0 ? ` ${parts.join(" • ")}` : "";
}
