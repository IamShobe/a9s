/**
 * Theme system: multiple named themes, switchable at runtime via :theme command.
 *
 * Monokai color strategy:
 * - Magenta: Primary brand/structure — panel titles, account name
 * - Blue: Active state — selected row bg, path bar bg, active tab bg
 * - Cyan: Table & panel structure — column headers, mode icon, detail labels, profile
 * - Yellow: Data & keys — account ID, identity line, keybinding keys
 * - Green: Location & success — region, success feedback, confirm keys
 * - Red: Errors & destructive
 * - White: Body text
 * - Gray: Subtle chrome — separators, dividers, inactive elements
 *
 * Catppuccin Mocha strategy (256-color hex palette):
 * - #cba6f7 Mauve:    panel titles, account name
 * - #89b4fa Blue:     selected row bg, path bar bg, active tab bg
 * - #89dceb Sky:      column headers, mode icon, detail labels, profile
 * - #f9e2af Yellow:   account ID, identity line, keybinding keys
 * - #a6e3a1 Green:    region, success feedback
 * - #f38ba8 Red:      errors
 * - #cdd6f4 Text:     body text
 * - #45475a Surface1: separators, dividers
 */

export interface HudColor {
  bg: string;
  fg: string;
}

export interface ThemeTokens {
  global: {
    mainBg: string;
  };
  table: {
    tableContainerBg: string;
    selectedRowBg: string;
    selectedRowText: string;
    filterMatchText: string;
    filterMatchSelectedText: string;
    columnHeaderText: string;
    columnHeaderMarker: string;
    rowSeparatorText: string;
    emptyStateText: string;
    scrollPositionText: string;
  };
  hud: {
    accountNameText: string;
    accountIdText: string;
    regionText: string;
    profileText: string;
    separatorText: string;
    currentIdentityText: string;
    pathBarBg: string;
    pathBarText: string;
    loadingSpinnerText: string;
  };
  modebar: {
    modeIconText: string;
    keybindingKeyText: string;
    keybindingDescText: string;
    keybindingSeparatorText: string;
  };
  panel: {
    panelTitleText: string;
    panelDividerText: string;
    panelHintText: string;
    panelScrollIndicatorText: string;
    detailFieldLabelText: string;
    defaultBorderText: string;
    helpPanelBorderText: string;
    yankPanelBorderText: string;
    detailPanelBorderText: string;
    activeTabBg: string;
    activeTabText: string;
    inactiveTabText: string;
    keyText: string;
  };
  diff: {
    originalHeaderText: string;
    updatedHeaderText: string;
    diffDividerText: string;
  };
  error: {
    errorBorderText: string;
    errorTitleText: string;
    errorHintText: string;
  };
  upload: {
    uploadBorderText: string;
    uploadTitleText: string;
    uploadSubtitleText: string;
    uploadDiffDividerText: string;
    uploadConfirmPromptText: string;
    uploadLoadingText: string;
    uploadConfirmKeyText: string;
    uploadCancelKeyText: string;
  };
  feedback: {
    successText: string;
    promptText: string;
    confirmText: string;
  };
  input: {
    placeholderText: string;
    suggestionText: string;
  };
  skeleton: {
    skeletonContextLabelText: string;
    skeletonHeaderText: string;
    skeletonDividerText: string;
    skeletonCellText: string;
    skeletonSeparatorText: string;
  };
  /** Per-service badge colors — components use these instead of adapter.hudColor */
  serviceColors: Record<string, HudColor>;
}

export type ThemeName = "monokai" | "catppuccin-mocha" | "nord" | "tokyo-night" | "gruvbox-dark" | "dracula";

export const THEME_LABELS: Record<ThemeName, string> = {
  monokai: "Monokai",
  "catppuccin-mocha": "Catppuccin Mocha",
  nord: "Nord",
  "tokyo-night": "Tokyo Night",
  "gruvbox-dark": "Gruvbox Dark",
  dracula: "Dracula",
};

// ─── Monokai (named terminal colors) ──────────────────────────────────────────

const MONOKAI_THEME: ThemeTokens = {
  global: {
    mainBg: "black",
  },
  table: {
    tableContainerBg: "black",
    selectedRowBg: "blue",
    selectedRowText: "white",
    filterMatchText: "yellow",
    filterMatchSelectedText: "white",
    columnHeaderText: "cyan",
    columnHeaderMarker: "yellow",
    rowSeparatorText: "gray",
    emptyStateText: "white",
    scrollPositionText: "green",
  },
  hud: {
    accountNameText: "magenta",
    accountIdText: "yellow",
    regionText: "green",
    profileText: "cyan",
    separatorText: "gray",
    currentIdentityText: "yellow",
    pathBarBg: "blue",
    pathBarText: "white",
    loadingSpinnerText: "cyan",
  },
  modebar: {
    modeIconText: "cyan",
    keybindingKeyText: "yellow",
    keybindingDescText: "white",
    keybindingSeparatorText: "gray",
  },
  panel: {
    panelTitleText: "magenta",
    panelDividerText: "gray",
    panelHintText: "white",
    panelScrollIndicatorText: "cyan",
    detailFieldLabelText: "cyan",
    defaultBorderText: "gray",
    helpPanelBorderText: "cyan",
    yankPanelBorderText: "cyan",
    detailPanelBorderText: "gray",
    activeTabBg: "blue",
    activeTabText: "white",
    inactiveTabText: "gray",
    keyText: "yellow",
  },
  diff: {
    originalHeaderText: "red",
    updatedHeaderText: "green",
    diffDividerText: "gray",
  },
  error: {
    errorBorderText: "red",
    errorTitleText: "red",
    errorHintText: "white",
  },
  upload: {
    uploadBorderText: "yellow",
    uploadTitleText: "yellow",
    uploadSubtitleText: "white",
    uploadDiffDividerText: "gray",
    uploadConfirmPromptText: "white",
    uploadLoadingText: "cyan",
    uploadConfirmKeyText: "green",
    uploadCancelKeyText: "red",
  },
  feedback: {
    successText: "green",
    promptText: "cyan",
    confirmText: "green",
  },
  input: {
    placeholderText: "gray",
    suggestionText: "cyan",
  },
  skeleton: {
    skeletonContextLabelText: "cyan",
    skeletonHeaderText: "yellow",
    skeletonDividerText: "gray",
    skeletonCellText: "gray",
    skeletonSeparatorText: "gray",
  },
  serviceColors: {
    s3: { bg: "red", fg: "white" },
    iam: { bg: "blue", fg: "white" },
    secretsmanager: { bg: "magenta", fg: "white" },
    route53: { bg: "cyan", fg: "black" },
    dynamodb: { bg: "green", fg: "black" },
  },
};

// ─── Catppuccin Mocha (256-color hex palette) ─────────────────────────────────
// https://github.com/catppuccin/catppuccin#-palette

const CATPPUCCIN_MOCHA_THEME: ThemeTokens = {
  global: {
    mainBg: "#1e1e2e", // Base
  },
  table: {
    tableContainerBg: "#1e1e2e",  // Base
    selectedRowBg: "#313244",     // Surface0
    selectedRowText: "#cdd6f4",   // Text
    filterMatchText: "#f9e2af",   // Yellow
    filterMatchSelectedText: "#cdd6f4",
    columnHeaderText: "#89dceb",  // Sky
    columnHeaderMarker: "#f9e2af",
    rowSeparatorText: "#313244",  // Surface0
    emptyStateText: "#cdd6f4",
    scrollPositionText: "#a6e3a1", // Green
  },
  hud: {
    accountNameText: "#cba6f7",   // Mauve
    accountIdText: "#f9e2af",     // Yellow
    regionText: "#a6e3a1",        // Green
    profileText: "#89dceb",       // Sky
    separatorText: "#45475a",     // Surface1
    currentIdentityText: "#f9e2af",
    pathBarBg: "#89b4fa",         // Blue
    pathBarText: "#1e1e2e",       // Base
    loadingSpinnerText: "#89dceb",
  },
  modebar: {
    modeIconText: "#89dceb",      // Sky
    keybindingKeyText: "#f9e2af", // Yellow
    keybindingDescText: "#cdd6f4",
    keybindingSeparatorText: "#45475a",
  },
  panel: {
    panelTitleText: "#cba6f7",    // Mauve
    panelDividerText: "#45475a",  // Surface1
    panelHintText: "#cdd6f4",
    panelScrollIndicatorText: "#89dceb",
    detailFieldLabelText: "#89dceb",
    defaultBorderText: "#45475a",
    helpPanelBorderText: "#89dceb",
    yankPanelBorderText: "#89dceb",
    detailPanelBorderText: "#45475a",
    activeTabBg: "#89b4fa",       // Blue
    activeTabText: "#1e1e2e",     // Base
    inactiveTabText: "#6c7086",   // Overlay0
    keyText: "#f9e2af",
  },
  diff: {
    originalHeaderText: "#f38ba8", // Red
    updatedHeaderText: "#a6e3a1",  // Green
    diffDividerText: "#45475a",
  },
  error: {
    errorBorderText: "#f38ba8",
    errorTitleText: "#f38ba8",
    errorHintText: "#cdd6f4",
  },
  upload: {
    uploadBorderText: "#f9e2af",
    uploadTitleText: "#f9e2af",
    uploadSubtitleText: "#cdd6f4",
    uploadDiffDividerText: "#45475a",
    uploadConfirmPromptText: "#cdd6f4",
    uploadLoadingText: "#89dceb",
    uploadConfirmKeyText: "#a6e3a1",
    uploadCancelKeyText: "#f38ba8",
  },
  feedback: {
    successText: "#a6e3a1",
    promptText: "#89dceb",
    confirmText: "#a6e3a1",
  },
  input: {
    placeholderText: "#6c7086",   // Overlay0
    suggestionText: "#89dceb",
  },
  skeleton: {
    skeletonContextLabelText: "#89dceb",
    skeletonHeaderText: "#f9e2af",
    skeletonDividerText: "#45475a",
    skeletonCellText: "#45475a",
    skeletonSeparatorText: "#45475a",
  },
  serviceColors: {
    s3: { bg: "#f38ba8", fg: "#1e1e2e" },           // Red
    iam: { bg: "#89b4fa", fg: "#1e1e2e" },          // Blue
    secretsmanager: { bg: "#cba6f7", fg: "#1e1e2e" }, // Mauve
    route53: { bg: "#89dceb", fg: "#1e1e2e" },      // Sky
    dynamodb: { bg: "#a6e3a1", fg: "#1e1e2e" },     // Green
  },
};

// ─── Nord ─────────────────────────────────────────────────────────────────────
// https://www.nordtheme.com/docs/colors-and-palettes

const NORD_THEME: ThemeTokens = {
  global: {
    mainBg: "#2e3440", // Polar Night 0
  },
  table: {
    tableContainerBg: "#2e3440",
    selectedRowBg: "#3b4252",    // Polar Night 1
    selectedRowText: "#eceff4",  // Snow Storm 2
    filterMatchText: "#ebcb8b",  // Aurora Yellow
    filterMatchSelectedText: "#eceff4",
    columnHeaderText: "#88c0d0", // Frost Blue
    columnHeaderMarker: "#ebcb8b",
    rowSeparatorText: "#3b4252",
    emptyStateText: "#d8dee9",
    scrollPositionText: "#a3be8c", // Aurora Green
  },
  hud: {
    accountNameText: "#b48ead",  // Aurora Purple
    accountIdText: "#ebcb8b",
    regionText: "#a3be8c",
    profileText: "#88c0d0",
    separatorText: "#4c566a",    // Polar Night 3
    currentIdentityText: "#ebcb8b",
    pathBarBg: "#5e81ac",        // Frost Dark Blue
    pathBarText: "#eceff4",
    loadingSpinnerText: "#88c0d0",
  },
  modebar: {
    modeIconText: "#88c0d0",
    keybindingKeyText: "#ebcb8b",
    keybindingDescText: "#d8dee9",
    keybindingSeparatorText: "#4c566a",
  },
  panel: {
    panelTitleText: "#b48ead",
    panelDividerText: "#4c566a",
    panelHintText: "#d8dee9",
    panelScrollIndicatorText: "#88c0d0",
    detailFieldLabelText: "#88c0d0",
    defaultBorderText: "#4c566a",
    helpPanelBorderText: "#88c0d0",
    yankPanelBorderText: "#88c0d0",
    detailPanelBorderText: "#4c566a",
    activeTabBg: "#5e81ac",
    activeTabText: "#eceff4",
    inactiveTabText: "#4c566a",
    keyText: "#ebcb8b",
  },
  diff: {
    originalHeaderText: "#bf616a", // Aurora Red
    updatedHeaderText: "#a3be8c",
    diffDividerText: "#4c566a",
  },
  error: {
    errorBorderText: "#bf616a",
    errorTitleText: "#bf616a",
    errorHintText: "#d8dee9",
  },
  upload: {
    uploadBorderText: "#ebcb8b",
    uploadTitleText: "#ebcb8b",
    uploadSubtitleText: "#d8dee9",
    uploadDiffDividerText: "#4c566a",
    uploadConfirmPromptText: "#d8dee9",
    uploadLoadingText: "#88c0d0",
    uploadConfirmKeyText: "#a3be8c",
    uploadCancelKeyText: "#bf616a",
  },
  feedback: {
    successText: "#a3be8c",
    promptText: "#88c0d0",
    confirmText: "#a3be8c",
  },
  input: {
    placeholderText: "#4c566a",
    suggestionText: "#88c0d0",
  },
  skeleton: {
    skeletonContextLabelText: "#88c0d0",
    skeletonHeaderText: "#ebcb8b",
    skeletonDividerText: "#4c566a",
    skeletonCellText: "#4c566a",
    skeletonSeparatorText: "#4c566a",
  },
  serviceColors: {
    s3: { bg: "#bf616a", fg: "#eceff4" },           // Aurora Red
    iam: { bg: "#5e81ac", fg: "#eceff4" },          // Frost Dark Blue
    secretsmanager: { bg: "#b48ead", fg: "#eceff4" }, // Aurora Purple
    route53: { bg: "#88c0d0", fg: "#2e3440" },      // Frost Blue
    dynamodb: { bg: "#a3be8c", fg: "#2e3440" },     // Aurora Green
  },
};

// ─── Tokyo Night ──────────────────────────────────────────────────────────────
// https://github.com/folke/tokyonight.nvim

const TOKYO_NIGHT_THEME: ThemeTokens = {
  global: {
    mainBg: "#1a1b26",
  },
  table: {
    tableContainerBg: "#1a1b26",
    selectedRowBg: "#292e42",    // bg_highlight
    selectedRowText: "#c0caf5",  // fg
    filterMatchText: "#e0af68",  // yellow
    filterMatchSelectedText: "#c0caf5",
    columnHeaderText: "#7dcfff", // cyan
    columnHeaderMarker: "#e0af68",
    rowSeparatorText: "#292e42",
    emptyStateText: "#c0caf5",
    scrollPositionText: "#9ece6a", // green
  },
  hud: {
    accountNameText: "#bb9af7",  // magenta/purple
    accountIdText: "#e0af68",
    regionText: "#9ece6a",
    profileText: "#7dcfff",
    separatorText: "#414868",    // terminal_black
    currentIdentityText: "#e0af68",
    pathBarBg: "#7aa2f7",        // blue
    pathBarText: "#1a1b26",
    loadingSpinnerText: "#7dcfff",
  },
  modebar: {
    modeIconText: "#7dcfff",
    keybindingKeyText: "#e0af68",
    keybindingDescText: "#c0caf5",
    keybindingSeparatorText: "#414868",
  },
  panel: {
    panelTitleText: "#bb9af7",
    panelDividerText: "#414868",
    panelHintText: "#c0caf5",
    panelScrollIndicatorText: "#7dcfff",
    detailFieldLabelText: "#7dcfff",
    defaultBorderText: "#414868",
    helpPanelBorderText: "#7dcfff",
    yankPanelBorderText: "#7dcfff",
    detailPanelBorderText: "#414868",
    activeTabBg: "#7aa2f7",
    activeTabText: "#1a1b26",
    inactiveTabText: "#414868",
    keyText: "#e0af68",
  },
  diff: {
    originalHeaderText: "#f7768e", // red
    updatedHeaderText: "#9ece6a",
    diffDividerText: "#414868",
  },
  error: {
    errorBorderText: "#f7768e",
    errorTitleText: "#f7768e",
    errorHintText: "#c0caf5",
  },
  upload: {
    uploadBorderText: "#e0af68",
    uploadTitleText: "#e0af68",
    uploadSubtitleText: "#c0caf5",
    uploadDiffDividerText: "#414868",
    uploadConfirmPromptText: "#c0caf5",
    uploadLoadingText: "#7dcfff",
    uploadConfirmKeyText: "#9ece6a",
    uploadCancelKeyText: "#f7768e",
  },
  feedback: {
    successText: "#9ece6a",
    promptText: "#7dcfff",
    confirmText: "#9ece6a",
  },
  input: {
    placeholderText: "#414868",
    suggestionText: "#7dcfff",
  },
  skeleton: {
    skeletonContextLabelText: "#7dcfff",
    skeletonHeaderText: "#e0af68",
    skeletonDividerText: "#414868",
    skeletonCellText: "#414868",
    skeletonSeparatorText: "#414868",
  },
  serviceColors: {
    s3: { bg: "#f7768e", fg: "#1a1b26" },           // red
    iam: { bg: "#7aa2f7", fg: "#1a1b26" },          // blue
    secretsmanager: { bg: "#bb9af7", fg: "#1a1b26" }, // magenta
    route53: { bg: "#7dcfff", fg: "#1a1b26" },      // cyan
    dynamodb: { bg: "#9ece6a", fg: "#1a1b26" },     // green
  },
};

// ─── Gruvbox Dark ─────────────────────────────────────────────────────────────
// https://github.com/morhetz/gruvbox

const GRUVBOX_DARK_THEME: ThemeTokens = {
  global: {
    mainBg: "#282828",
  },
  table: {
    tableContainerBg: "#282828",
    selectedRowBg: "#3c3836",    // bg1
    selectedRowText: "#ebdbb2",  // fg
    filterMatchText: "#fabd2f",  // bright yellow
    filterMatchSelectedText: "#ebdbb2",
    columnHeaderText: "#83a598", // bright blue
    columnHeaderMarker: "#fabd2f",
    rowSeparatorText: "#3c3836",
    emptyStateText: "#ebdbb2",
    scrollPositionText: "#b8bb26", // bright green
  },
  hud: {
    accountNameText: "#d3869b",  // bright purple
    accountIdText: "#fabd2f",
    regionText: "#b8bb26",
    profileText: "#83a598",
    separatorText: "#665c54",    // bg3
    currentIdentityText: "#fabd2f",
    pathBarBg: "#458588",        // blue
    pathBarText: "#ebdbb2",
    loadingSpinnerText: "#83a598",
  },
  modebar: {
    modeIconText: "#83a598",
    keybindingKeyText: "#fabd2f",
    keybindingDescText: "#ebdbb2",
    keybindingSeparatorText: "#665c54",
  },
  panel: {
    panelTitleText: "#d3869b",
    panelDividerText: "#665c54",
    panelHintText: "#ebdbb2",
    panelScrollIndicatorText: "#83a598",
    detailFieldLabelText: "#83a598",
    defaultBorderText: "#665c54",
    helpPanelBorderText: "#83a598",
    yankPanelBorderText: "#83a598",
    detailPanelBorderText: "#665c54",
    activeTabBg: "#458588",
    activeTabText: "#ebdbb2",
    inactiveTabText: "#665c54",
    keyText: "#fabd2f",
  },
  diff: {
    originalHeaderText: "#fb4934", // bright red
    updatedHeaderText: "#b8bb26",
    diffDividerText: "#665c54",
  },
  error: {
    errorBorderText: "#fb4934",
    errorTitleText: "#fb4934",
    errorHintText: "#ebdbb2",
  },
  upload: {
    uploadBorderText: "#fabd2f",
    uploadTitleText: "#fabd2f",
    uploadSubtitleText: "#ebdbb2",
    uploadDiffDividerText: "#665c54",
    uploadConfirmPromptText: "#ebdbb2",
    uploadLoadingText: "#83a598",
    uploadConfirmKeyText: "#b8bb26",
    uploadCancelKeyText: "#fb4934",
  },
  feedback: {
    successText: "#b8bb26",
    promptText: "#83a598",
    confirmText: "#b8bb26",
  },
  input: {
    placeholderText: "#665c54",
    suggestionText: "#83a598",
  },
  skeleton: {
    skeletonContextLabelText: "#83a598",
    skeletonHeaderText: "#fabd2f",
    skeletonDividerText: "#665c54",
    skeletonCellText: "#665c54",
    skeletonSeparatorText: "#665c54",
  },
  serviceColors: {
    s3: { bg: "#fb4934", fg: "#282828" },           // bright red
    iam: { bg: "#83a598", fg: "#282828" },          // bright blue
    secretsmanager: { bg: "#d3869b", fg: "#282828" }, // bright purple
    route53: { bg: "#8ec07c", fg: "#282828" },      // bright aqua
    dynamodb: { bg: "#b8bb26", fg: "#282828" },     // bright green
  },
};

// ─── Dracula ──────────────────────────────────────────────────────────────────
// https://draculatheme.com/contribute

const DRACULA_THEME: ThemeTokens = {
  global: {
    mainBg: "#282a36",
  },
  table: {
    tableContainerBg: "#282a36",
    selectedRowBg: "#44475a",    // Current Line
    selectedRowText: "#f8f8f2",  // Foreground
    filterMatchText: "#f1fa8c",  // Yellow
    filterMatchSelectedText: "#f8f8f2",
    columnHeaderText: "#8be9fd", // Cyan
    columnHeaderMarker: "#f1fa8c",
    rowSeparatorText: "#44475a",
    emptyStateText: "#f8f8f2",
    scrollPositionText: "#50fa7b", // Green
  },
  hud: {
    accountNameText: "#ff79c6",  // Pink
    accountIdText: "#f1fa8c",
    regionText: "#50fa7b",
    profileText: "#8be9fd",
    separatorText: "#6272a4",    // Comment
    currentIdentityText: "#f1fa8c",
    pathBarBg: "#bd93f9",        // Purple
    pathBarText: "#282a36",
    loadingSpinnerText: "#8be9fd",
  },
  modebar: {
    modeIconText: "#8be9fd",
    keybindingKeyText: "#f1fa8c",
    keybindingDescText: "#f8f8f2",
    keybindingSeparatorText: "#6272a4",
  },
  panel: {
    panelTitleText: "#ff79c6",
    panelDividerText: "#6272a4",
    panelHintText: "#f8f8f2",
    panelScrollIndicatorText: "#8be9fd",
    detailFieldLabelText: "#8be9fd",
    defaultBorderText: "#6272a4",
    helpPanelBorderText: "#8be9fd",
    yankPanelBorderText: "#8be9fd",
    detailPanelBorderText: "#6272a4",
    activeTabBg: "#bd93f9",
    activeTabText: "#282a36",
    inactiveTabText: "#6272a4",
    keyText: "#f1fa8c",
  },
  diff: {
    originalHeaderText: "#ff5555", // Red
    updatedHeaderText: "#50fa7b",
    diffDividerText: "#6272a4",
  },
  error: {
    errorBorderText: "#ff5555",
    errorTitleText: "#ff5555",
    errorHintText: "#f8f8f2",
  },
  upload: {
    uploadBorderText: "#ffb86c",   // Orange
    uploadTitleText: "#ffb86c",
    uploadSubtitleText: "#f8f8f2",
    uploadDiffDividerText: "#6272a4",
    uploadConfirmPromptText: "#f8f8f2",
    uploadLoadingText: "#8be9fd",
    uploadConfirmKeyText: "#50fa7b",
    uploadCancelKeyText: "#ff5555",
  },
  feedback: {
    successText: "#50fa7b",
    promptText: "#8be9fd",
    confirmText: "#50fa7b",
  },
  input: {
    placeholderText: "#6272a4",
    suggestionText: "#8be9fd",
  },
  skeleton: {
    skeletonContextLabelText: "#8be9fd",
    skeletonHeaderText: "#f1fa8c",
    skeletonDividerText: "#6272a4",
    skeletonCellText: "#6272a4",
    skeletonSeparatorText: "#6272a4",
  },
  serviceColors: {
    s3: { bg: "#ff5555", fg: "#282a36" },           // Red
    iam: { bg: "#bd93f9", fg: "#282a36" },          // Purple
    secretsmanager: { bg: "#ff79c6", fg: "#282a36" }, // Pink
    route53: { bg: "#8be9fd", fg: "#282a36" },      // Cyan
    dynamodb: { bg: "#50fa7b", fg: "#282a36" },     // Green
  },
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const THEMES: Record<ThemeName, ThemeTokens> = {
  monokai: MONOKAI_THEME,
  "catppuccin-mocha": CATPPUCCIN_MOCHA_THEME,
  nord: NORD_THEME,
  "tokyo-night": TOKYO_NIGHT_THEME,
  "gruvbox-dark": GRUVBOX_DARK_THEME,
  dracula: DRACULA_THEME,
};

/**
 * Backward-compat export for service adapters that statically import hudColor.
 * Components should derive hudColor from useTheme().serviceColors instead.
 */
export const SERVICE_COLORS: Record<string, HudColor> = MONOKAI_THEME.serviceColors;
