import type { HelpItem, HelpTab } from "../components/HelpPanel.js";

export interface KeyBinding {
  key: string;
  description: string;
  scope: KeyScope;
  condition?: string; // e.g. "S3 only"
}

export type KeyScope =
  | "navigate"
  | "search"
  | "command"
  | "yank"
  | "details"
  | "upload"
  | "picker";

const SCOPE_LABELS: Record<KeyScope, string> = {
  navigate: "Navigate",
  search: "Search",
  command: "Command",
  yank: "Yank",
  details: "Details",
  upload: "Upload",
  picker: "Pickers",
};

export const KEYBINDINGS: KeyBinding[] = [
  // Navigate
  { key: "j / ↓", description: "Move selection down", scope: "navigate" },
  { key: "k / ↑", description: "Move selection up", scope: "navigate" },
  { key: "g g / G", description: "Top / bottom", scope: "navigate" },
  { key: "g p", description: "Go to path jump prompt", scope: "navigate", condition: "S3" },
  { key: "Enter", description: "Open bucket/folder", scope: "navigate" },
  { key: "e", description: "Edit selected item", scope: "navigate" },
  { key: "f", description: "Fetch / download selected file", scope: "navigate", condition: "S3" },
  { key: "d", description: "Open details panel", scope: "navigate" },
  { key: "y", description: "Open yank mode", scope: "navigate" },
  { key: "/", description: "Search mode", scope: "navigate" },
  { key: ":", description: "Command mode", scope: "navigate" },
  { key: "r", description: "Refresh", scope: "navigate" },
  { key: "q", description: "Quit", scope: "navigate" },
  { key: "Esc", description: "Clear filter, then go back level", scope: "navigate" },
  { key: "?", description: "Open this help (navigate mode only)", scope: "navigate" },

  // Search
  { key: "Open", description: "Press / in navigate mode", scope: "search" },
  { key: "Type", description: "Update filter text", scope: "search" },
  { key: "Tab", description: "Autocomplete input", scope: "search" },
  { key: "Enter", description: "Apply filter and return to navigate", scope: "search" },
  { key: "Esc", description: "Cancel and restore previous filter", scope: "search" },

  // Command
  { key: "Open", description: "Press : in navigate mode", scope: "command" },
  { key: "Type", description: "Enter command (s3/route53/dynamodb/iam/quit)", scope: "command" },
  { key: "Tab", description: "Autocomplete command", scope: "command" },
  { key: "Enter", description: "Run command", scope: "command" },
  { key: "Esc", description: "Cancel command mode", scope: "command" },

  // Yank
  { key: "Open", description: "Press y in navigate mode", scope: "yank" },
  { key: "n", description: "Copy selected name", scope: "yank" },
  { key: "a", description: "Copy ARN (when available)", scope: "yank" },
  { key: "k", description: "Copy selected S3/object key path", scope: "yank", condition: "S3" },
  { key: "e", description: "Copy ETag (objects only)", scope: "yank", condition: "S3" },
  { key: "d", description: "Copy Last Modified (objects only)", scope: "yank", condition: "S3" },
  { key: "Esc", description: "Cancel yank mode", scope: "yank" },

  // Details
  { key: "Open", description: "Press d in navigate mode", scope: "details" },
  { key: "Esc", description: "Close details panel", scope: "details" },

  // Upload
  { key: "When", description: "After editing if file changed", scope: "upload" },
  { key: "y", description: "Upload edited file", scope: "upload" },
  { key: "n / Esc", description: "Cancel upload", scope: "upload" },

  // Pickers (region/profile/resource)
  { key: "j / ↓", description: "Move down", scope: "picker" },
  { key: "k / ↑", description: "Move up", scope: "picker" },
  { key: "g g / G", description: "Top / bottom", scope: "picker" },
  { key: "/", description: "Filter", scope: "picker" },
  { key: "Enter", description: "Confirm selection", scope: "picker" },
  { key: "Esc", description: "Close", scope: "picker" },
];

const SCOPE_ORDER: KeyScope[] = [
  "navigate",
  "search",
  "command",
  "yank",
  "details",
  "upload",
  "picker",
];

/**
 * Build HelpPanel tabs from KEYBINDINGS. Pass adapterId to include adapter-specific bindings.
 */
export function buildHelpTabs(adapterId?: string): HelpTab[] {
  const groups = new Map<KeyScope, HelpItem[]>();

  for (const kb of KEYBINDINGS) {
    // Skip S3-only bindings if not S3
    if (kb.condition === "S3" && adapterId !== "s3") continue;

    if (!groups.has(kb.scope)) groups.set(kb.scope, []);
    groups.get(kb.scope)!.push({
      key: kb.key,
      description: kb.condition ? `${kb.description} (${kb.condition})` : kb.description,
    });
  }

  return SCOPE_ORDER.filter((s) => groups.has(s)).map((s) => ({
    title: SCOPE_LABELS[s],
    items: groups.get(s)!,
  }));
}

/** Derive the navigate mode hint string from KEYBINDINGS */
export function buildNavigateHint(): string {
  const navigateKeys = KEYBINDINGS.filter(
    (kb) => kb.scope === "navigate" && !kb.condition,
  );
  return (
    " " +
    navigateKeys
      .slice(0, 6)
      .map((kb) => `${kb.key} ${kb.description.toLowerCase()}`)
      .join("  •  ")
  );
}
