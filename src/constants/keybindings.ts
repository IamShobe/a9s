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
  | { type: "key"; char: string } // single printable char e.g. "j"
  | { type: "special"; name: SpecialKeyName }
  | { type: "chord"; keys: string[] } // sequence of chars e.g. ["g","g"]
  | { type: "any"; of: KeyTrigger[] }; // matches any of the sub-triggers

/** Convert a trigger to a human-readable display string */
export function triggerToString(t: KeyTrigger): string {
  switch (t.type) {
    case "key":
      return t.char;
    case "special":
      return SPECIAL_DISPLAY[t.name];
    case "chord":
      return t.keys.join(" ");
    case "any":
      return t.of.map(triggerToString).join(" / ");
  }
}

const SPECIAL_DISPLAY: Record<SpecialKeyName, string> = {
  return: "Enter",
  escape: "Esc",
  tab: "Tab",
  upArrow: "↑",
  downArrow: "↓",
  leftArrow: "←",
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
  search: "Search",
  command: "Command",
  yank: "Yank",
  details: "Details",
  upload: "Upload",
  picker: "Pickers",
  help: "Help Panel",
};

// ---------------------------------------------------------------------------
// KeyBinding
// ---------------------------------------------------------------------------

export interface KeyBindingContext {
  hasHiddenSecrets: boolean; // true if there are secret values AND they're currently hidden
  // Add more context fields as needed
}

export interface KeyBinding {
  action: KeyAction;
  trigger: KeyTrigger;
  scope: KeyScope;
  label: string; // help panel (long description)
  shortLabel: string; // hint bar (concise)
  priority?: number; // lower number = more prominent in hints (default 100)
  showIf?: (context: KeyBindingContext) => boolean; // conditional visibility in hints
}

// ---------------------------------------------------------------------------
// Registry — THE single source of truth for every keybinding
// ---------------------------------------------------------------------------

const j_down: KeyTrigger = {
  type: "any",
  of: [
    { type: "key", char: "j" },
    { type: "special", name: "downArrow" },
  ],
};
const k_up: KeyTrigger = {
  type: "any",
  of: [
    { type: "key", char: "k" },
    { type: "special", name: "upArrow" },
  ],
};

export const KEYBINDINGS: KeyBinding[] = [
  // --- Navigate ---
  {
    action: KB.MOVE_DOWN,
    trigger: j_down,
    scope: "navigate",
    label: "Move selection down",
    shortLabel: "down",
  },
  {
    action: KB.MOVE_UP,
    trigger: k_up,
    scope: "navigate",
    label: "Move selection up",
    shortLabel: "up",
  },
  {
    action: KB.GO_TOP,
    trigger: { type: "chord", keys: ["g", "g"] },
    scope: "navigate",
    label: "Jump to top",
    shortLabel: "top",
  },
  {
    action: KB.GO_BOTTOM,
    trigger: { type: "key", char: "G" },
    scope: "navigate",
    label: "Jump to bottom",
    shortLabel: "bottom",
  },
  {
    action: KB.NAVIGATE_INTO,
    trigger: { type: "special", name: "return" },
    scope: "navigate",
    label: "Navigate into / select",
    shortLabel: "navigate",
  },
  {
    action: KB.EDIT,
    trigger: { type: "key", char: "e" },
    scope: "navigate",
    label: "Edit selected item",
    shortLabel: "edit",
  },
  {
    action: KB.DETAILS,
    trigger: { type: "key", char: "d" },
    scope: "navigate",
    label: "Open details panel",
    shortLabel: "details",
  },
  {
    action: KB.YANK_MODE,
    trigger: { type: "key", char: "y" },
    scope: "navigate",
    label: "Open yank mode",
    shortLabel: "yank",
  },
  {
    action: KB.SEARCH_MODE,
    trigger: { type: "key", char: "/" },
    scope: "navigate",
    label: "Search mode",
    shortLabel: "search",
  },
  {
    action: KB.COMMAND_MODE,
    trigger: { type: "key", char: ":" },
    scope: "navigate",
    label: "Command mode",
    shortLabel: "command",
  },
  {
    action: KB.REFRESH,
    trigger: { type: "key", char: "r" },
    scope: "navigate",
    label: "Refresh",
    shortLabel: "refresh",
  },
  {
    action: KB.RELATED_RESOURCES,
    trigger: { type: "chord", keys: ["g", "r"] },
    scope: "navigate",
    label: "Jump to related resource (e.g. Lambda → CloudWatch)",
    shortLabel: "related",
  },
  {
    action: KB.REVEAL_TOGGLE,
    trigger: { type: "key", char: "v" },
    scope: "navigate",
    label: "Toggle reveal secrets",
    shortLabel: "reveal",
    priority: 90,
    showIf: (ctx) => ctx.hasHiddenSecrets,
  },
  {
    action: KB.OPEN_IN_BROWSER,
    trigger: { type: "key", char: "o" },
    scope: "navigate",
    label: "Open in AWS console (browser)",
    shortLabel: "open",
  },
  {
    action: KB.SORT_COLUMN,
    trigger: { type: "key", char: "S" },
    scope: "navigate",
    label: "Cycle sort across columns (col asc → col desc → next col → … → clear)",
    shortLabel: "sort",
  },
  {
    action: KB.HEATMAP_TOGGLE,
    trigger: { type: "key", char: "H" },
    scope: "navigate",
    label: "Toggle numeric column heatmap",
    shortLabel: "heatmap",
  },
  {
    action: KB.MULTI_SELECT_TOGGLE,
    trigger: { type: "key", char: " " },
    scope: "navigate",
    label: "Toggle row selection (multi-select)",
    shortLabel: "select",
  },
  {
    action: KB.MULTI_SELECT_RANGE,
    trigger: { type: "key", char: "V" },
    scope: "navigate",
    label: "Range-select to current row",
    shortLabel: "range-select",
  },
  {
    action: KB.MULTI_SELECT_ALL,
    trigger: { type: "key", char: "\x01" },
    scope: "navigate",
    label: "Select all visible rows",
    shortLabel: "select all",
  },
  {
    action: KB.BOOKMARK_TOGGLE,
    trigger: { type: "key", char: "m" },
    scope: "navigate",
    label: "Toggle bookmark for current row",
    shortLabel: "bookmark",
  },
  {
    action: KB.HISTOGRAM,
    trigger: { type: "key", char: "i" },
    scope: "navigate",
    label: "Show column histogram",
    shortLabel: "histogram",
  },
  {
    action: KB.QUIT,
    trigger: { type: "key", char: "q" },
    scope: "navigate",
    label: "Quit",
    shortLabel: "quit",
  },
  {
    action: KB.HELP,
    trigger: { type: "key", char: "?" },
    scope: "navigate",
    label: "Open help (navigate mode only)",
    shortLabel: "help",
  },

  // --- Search (informational — text input handles actual typing) ---
  {
    action: KB.SEARCH_MODE,
    trigger: { type: "key", char: "/" },
    scope: "search",
    label: "Open: press / in navigate mode",
    shortLabel: "open search",
  },
  {
    action: KB.NAVIGATE_INTO,
    trigger: { type: "special", name: "return" },
    scope: "search",
    label: "Apply filter and return to navigate",
    shortLabel: "apply filter",
  },
  {
    action: KB.QUIT,
    trigger: { type: "special", name: "escape" },
    scope: "search",
    label: "Cancel and restore previous filter",
    shortLabel: "cancel search",
  },

  // --- Command (informational) ---
  {
    action: KB.COMMAND_MODE,
    trigger: { type: "key", char: ":" },
    scope: "command",
    label: "Open: press : in navigate mode",
    shortLabel: "open command",
  },
  {
    action: KB.NAVIGATE_INTO,
    trigger: { type: "special", name: "return" },
    scope: "command",
    label: "Run command",
    shortLabel: "run",
  },
  {
    action: KB.QUIT,
    trigger: { type: "special", name: "escape" },
    scope: "command",
    label: "Cancel command mode",
    shortLabel: "cancel",
  },

  // --- Yank (informational — actual options come from adapter.capabilities?.yank?.getYankOptions) ---
  {
    action: KB.YANK_MODE,
    trigger: { type: "key", char: "y" },
    scope: "yank",
    label: "Open: press y in navigate mode",
    shortLabel: "open yank",
  },
  {
    action: KB.YANK_MODE,
    trigger: { type: "key", char: "n" },
    scope: "yank",
    label: "Copy selected name",
    shortLabel: "copy name",
  },
  {
    action: KB.YANK_MODE,
    trigger: { type: "key", char: "a" },
    scope: "yank",
    label: "Copy ARN (when available)",
    shortLabel: "copy arn",
  },
  {
    action: KB.QUIT,
    trigger: { type: "special", name: "escape" },
    scope: "yank",
    label: "Cancel yank mode",
    shortLabel: "cancel",
  },

  // --- Upload (informational) ---
  {
    action: KB.MOVE_DOWN,
    trigger: j_down,
    scope: "upload",
    label: "Scroll diff down",
    shortLabel: "scroll down",
  },
  {
    action: KB.MOVE_UP,
    trigger: k_up,
    scope: "upload",
    label: "Scroll diff up",
    shortLabel: "scroll up",
  },
  {
    action: KB.YANK_MODE,
    trigger: { type: "key", char: "y" },
    scope: "upload",
    label: "Upload edited file",
    shortLabel: "upload",
  },
  {
    action: KB.QUIT,
    trigger: {
      type: "any",
      of: [
        { type: "key", char: "n" },
        { type: "special", name: "escape" },
      ],
    },
    scope: "upload",
    label: "Cancel upload",
    shortLabel: "cancel",
  },

  // --- Details ---
  {
    action: KB.DETAILS,
    trigger: { type: "key", char: "d" },
    scope: "details",
    label: "Open: press d in navigate mode",
    shortLabel: "open details",
  },
  {
    action: KB.MOVE_DOWN,
    trigger: j_down,
    scope: "details",
    label: "Scroll down",
    shortLabel: "scroll down",
  },
  {
    action: KB.MOVE_UP,
    trigger: k_up,
    scope: "details",
    label: "Scroll up",
    shortLabel: "scroll up",
  },
  {
    action: KB.QUIT,
    trigger: { type: "special", name: "escape" },
    scope: "details",
    label: "Close details panel",
    shortLabel: "close",
  },

  // --- Picker ---
  {
    action: KB.PICKER_DOWN,
    trigger: j_down,
    scope: "picker",
    label: "Move down",
    shortLabel: "down",
  },
  { action: KB.PICKER_UP, trigger: k_up, scope: "picker", label: "Move up", shortLabel: "up" },
  {
    action: KB.PICKER_TOP,
    trigger: { type: "chord", keys: ["g", "g"] },
    scope: "picker",
    label: "Jump to top",
    shortLabel: "top",
  },
  {
    action: KB.PICKER_BOTTOM,
    trigger: { type: "key", char: "G" },
    scope: "picker",
    label: "Jump to bottom",
    shortLabel: "bottom",
  },
  {
    action: KB.PICKER_FILTER,
    trigger: { type: "key", char: "/" },
    scope: "picker",
    label: "Filter",
    shortLabel: "filter",
  },
  {
    action: KB.PICKER_CONFIRM,
    trigger: { type: "special", name: "return" },
    scope: "picker",
    label: "Confirm selection",
    shortLabel: "confirm",
  },
  {
    action: KB.PICKER_CLOSE,
    trigger: { type: "special", name: "escape" },
    scope: "picker",
    label: "Close",
    shortLabel: "close",
  },

  // --- Help panel ---
  {
    action: KB.HELP_PREV_TAB,
    trigger: {
      type: "any",
      of: [
        { type: "key", char: "h" },
        { type: "special", name: "leftArrow" },
      ],
    },
    scope: "help",
    label: "Previous tab",
    shortLabel: "prev",
  },
  {
    action: KB.HELP_NEXT_TAB,
    trigger: {
      type: "any",
      of: [
        { type: "key", char: "l" },
        { type: "special", name: "rightArrow" },
      ],
    },
    scope: "help",
    label: "Next tab",
    shortLabel: "next",
  },
  {
    action: KB.HELP_SCROLL_UP,
    trigger: k_up,
    scope: "help",
    label: "Scroll up",
    shortLabel: "scroll up",
  },
  {
    action: KB.HELP_SCROLL_DOWN,
    trigger: j_down,
    scope: "help",
    label: "Scroll down",
    shortLabel: "scroll down",
  },
  {
    action: KB.HELP_CLOSE,
    trigger: {
      type: "any",
      of: [
        { type: "key", char: "?" },
        { type: "special", name: "escape" },
      ],
    },
    scope: "help",
    label: "Close help",
    shortLabel: "close",
  },
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
 * Pass `context` to apply the same `showIf` filtering as the hint bar.
 */
export function buildHelpTabs(
  adapterId?: string,
  adapterBindings?: AdapterKeyBinding[],
  context: KeyBindingContext = { hasHiddenSecrets: false },
): HelpTab[] {
  const groups = new Map<KeyScope, HelpItem[]>();

  for (const kb of KEYBINDINGS) {
    if (kb.showIf && !kb.showIf(context)) continue;
    if (!groups.has(kb.scope)) groups.set(kb.scope, []);
    groups.get(kb.scope)!.push({
      key: triggerToString(kb.trigger),
      description: kb.label,
    });
  }

  // Add adapter-specific bindings
  if (adapterBindings) {
    for (const ab of adapterBindings) {
      if (ab.showIf && !ab.showIf(context)) continue;
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

/** Generic bottom-hint builder for a given scope, derived from KEYBINDINGS and adapter bindings. */
export function buildScopeHint(
  scope: KeyScope,
  opts?: {
    adapterBindings?: AdapterKeyBinding[];
    maxItems?: number;
    context?: KeyBindingContext;
  },
): string {
  const adapterBindings = opts?.adapterBindings;
  const maxItems = opts?.maxItems ?? 8;
  const context: KeyBindingContext = opts?.context ?? { hasHiddenSecrets: false };
  const filtered = KEYBINDINGS.filter((kb) => kb.scope === scope);

  const seen = new Set<string>();
  const compact = filtered.filter((kb) => {
    const key = `${kb.action}|${triggerToString(kb.trigger)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Process adapter-specific bindings with filtering and priority support
  const adapterBindingsByKey = new Map<
    string,
    { trigger: KeyTrigger; shortLabel: string; priority?: number }
  >();

  if (adapterBindings) {
    for (const ab of adapterBindings) {
      if ((ab.scope || "navigate") === scope) {
        const key = `${ab.actionId}|${triggerToString(ab.trigger)}`;
        if (!seen.has(key)) {
          const passesFilter = !ab.showIf || ab.showIf(context);
          if (passesFilter) {
            seen.add(key);
            const shortLabel = ab.shortLabel || ab.label;
            const item: { trigger: KeyTrigger; shortLabel: string; priority?: number } = {
              trigger: ab.trigger,
              shortLabel: `${ab.adapterId}: ${shortLabel}`,
            };
            if (ab.priority !== undefined) {
              item.priority = ab.priority;
            }
            adapterBindingsByKey.set(key, item);
          }
        }
      }
    }
  }

  type HintItem = { trigger: KeyTrigger; shortLabel: string };
  let ordered: HintItem[];

  if (scope === "navigate") {
    // Filter core bindings
    const filteredCore = compact.filter((kb) => !kb.showIf || kb.showIf(context));

    // Create sortable items with priority
    interface SortableItem extends HintItem {
      priority: number;
    }

    const allItems: SortableItem[] = [
      ...filteredCore.map((kb) => ({
        trigger: kb.trigger,
        shortLabel: kb.shortLabel,
        priority: kb.priority ?? 100,
      })),
      ...Array.from(adapterBindingsByKey.values()).map((item) => ({
        trigger: item.trigger,
        shortLabel: item.shortLabel,
        priority: item.priority ?? 100,
      })),
    ];

    // Sort by priority (lower number = higher prominence) and drop the priority field
    ordered = allItems
      .sort((a, b) => a.priority - b.priority)
      .map(({ priority: _priority, ...item }) => item);
  } else {
    // For non-navigate scopes, filter but maintain source order (core first, then adapters)
    const filteredCore = compact
      .filter((kb) => !kb.showIf || kb.showIf(context))
      .map((kb) => ({
        trigger: kb.trigger,
        shortLabel: kb.shortLabel,
      }));

    ordered = [
      ...filteredCore,
      ...Array.from(adapterBindingsByKey.values()).map((item) => ({
        trigger: item.trigger,
        shortLabel: item.shortLabel,
      })),
    ];
  }

  const parts = ordered.slice(0, maxItems).map((item) => {
    return `${triggerToString(item.trigger)} · ${item.shortLabel}`;
  });

  return parts.length > 0 ? ` ${parts.join(" • ")}` : "";
}
