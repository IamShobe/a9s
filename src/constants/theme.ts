/**
 * Theme system: multiple named themes, switchable at runtime via :theme command.
 *
 * Each theme is defined as a compact ThemePalette (~12 fields). The createTheme()
 * factory derives all 70+ ThemeTokens from those palette roles. Optional palette
 * fields override the default derivation for themes that deviate from the pattern.
 *
 * Semantic color roles:
 * - brand:      panel titles, account name (magenta/mauve/pink)
 * - data:       account ID, keybinding keys, upload title (yellow/amber)
 * - structure:  column headers, labels, profile (cyan/sky/teal)
 * - location:   region, success messages (green)
 * - danger:     errors, cancel key (red)
 * - subtle:     dividers, separators, inactive borders (gray/surface)
 * - navigationBg: path bar bg, active tab bg (blue/purple)
 * - navigationFg: text on navigation bg (inverted or light)
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

// ---------------------------------------------------------------------------
// Palette — compact per-theme definition
// ---------------------------------------------------------------------------

interface ThemePalette {
  bg: string;             // terminal background
  subtle: string;         // dividers, separators, inactive borders
  rowSelectedBg: string;  // selected table row background
  navigationBg: string;   // path bar bg, active tab bg
  navigationFg: string;   // text on path bar / active tab
  text: string;           // body text
  brand: string;          // account name, panel titles
  data: string;           // account ID, keybinding keys, upload title/border
  structure: string;      // column headers, labels, profile
  location: string;       // region, success messages
  danger: string;         // errors, cancel key
  serviceColors: Record<string, HudColor>;
  // Optional overrides for themes that deviate from the default derivation:
  rowSeparator?: string;  // defaults to rowSelectedBg (Monokai uses subtle/gray)
  dimText?: string;       // placeholder/inactive text (defaults to subtle; Catppuccin uses Overlay0)
}

function createTheme(p: ThemePalette): ThemeTokens {
  const rowSep = p.rowSeparator ?? p.rowSelectedBg;
  const dim = p.dimText ?? p.subtle;
  return {
    global: { mainBg: p.bg },
    table: {
      tableContainerBg: p.bg,
      selectedRowBg: p.rowSelectedBg,
      selectedRowText: p.text,
      filterMatchText: p.data,
      filterMatchSelectedText: p.text,
      columnHeaderText: p.structure,
      columnHeaderMarker: p.data,
      rowSeparatorText: rowSep,
      emptyStateText: p.text,
      scrollPositionText: p.location,
    },
    hud: {
      accountNameText: p.brand,
      accountIdText: p.data,
      regionText: p.location,
      profileText: p.structure,
      separatorText: p.subtle,
      currentIdentityText: p.data,
      pathBarBg: p.navigationBg,
      pathBarText: p.navigationFg,
      loadingSpinnerText: p.structure,
    },
    modebar: {
      modeIconText: p.structure,
      keybindingKeyText: p.data,
      keybindingDescText: p.text,
      keybindingSeparatorText: p.subtle,
    },
    panel: {
      panelTitleText: p.brand,
      panelDividerText: p.subtle,
      panelHintText: p.text,
      panelScrollIndicatorText: p.structure,
      detailFieldLabelText: p.structure,
      defaultBorderText: p.subtle,
      helpPanelBorderText: p.structure,
      yankPanelBorderText: p.structure,
      detailPanelBorderText: p.subtle,
      activeTabBg: p.navigationBg,
      activeTabText: p.navigationFg,
      inactiveTabText: dim,
      keyText: p.data,
    },
    diff: {
      originalHeaderText: p.danger,
      updatedHeaderText: p.location,
      diffDividerText: p.subtle,
    },
    error: {
      errorBorderText: p.danger,
      errorTitleText: p.danger,
      errorHintText: p.text,
    },
    upload: {
      uploadBorderText: p.data,
      uploadTitleText: p.data,
      uploadSubtitleText: p.text,
      uploadDiffDividerText: p.subtle,
      uploadConfirmPromptText: p.text,
      uploadLoadingText: p.structure,
      uploadConfirmKeyText: p.location,
      uploadCancelKeyText: p.danger,
    },
    feedback: {
      successText: p.location,
      promptText: p.structure,
      confirmText: p.location,
    },
    input: {
      placeholderText: dim,
      suggestionText: p.structure,
    },
    skeleton: {
      skeletonContextLabelText: p.structure,
      skeletonHeaderText: p.data,
      skeletonDividerText: p.subtle,
      skeletonCellText: p.subtle,
      skeletonSeparatorText: p.subtle,
    },
    serviceColors: p.serviceColors,
  };
}

// ---------------------------------------------------------------------------
// Theme definitions
// ---------------------------------------------------------------------------

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
// rowSeparator: uses "gray" (subtle) not "blue" (rowSelectedBg)

const MONOKAI_THEME = createTheme({
  bg: "black",
  subtle: "gray",
  rowSelectedBg: "blue",
  rowSeparator: "gray",
  navigationBg: "blue",
  navigationFg: "white",
  text: "white",
  brand: "magenta",
  data: "yellow",
  structure: "cyan",
  location: "green",
  danger: "red",
  serviceColors: {
    s3: { bg: "red", fg: "white" },
    iam: { bg: "blue", fg: "white" },
    secretsmanager: { bg: "magenta", fg: "white" },
    route53: { bg: "cyan", fg: "black" },
    dynamodb: { bg: "green", fg: "black" },
    ec2: { bg: "yellow", fg: "black" },
    lambda: { bg: "white", fg: "black" },
    ecs: { bg: "magenta", fg: "white" },
    cloudwatch: { bg: "cyan", fg: "black" },
    ebs: { bg: "yellow", fg: "black" },
    elb: { bg: "blue", fg: "white" },
    rds: { bg: "red", fg: "white" },
    sqs: { bg: "green", fg: "black" },
    cloudformation: { bg: "yellow", fg: "black" },
    sns: { bg: "red", fg: "white" },
    ssm: { bg: "cyan", fg: "black" },
    vpc: { bg: "blue", fg: "white" },
    ecr: { bg: "magenta", fg: "white" },
    stepfunctions: { bg: "cyan", fg: "black" },
    eventbridge: { bg: "yellow", fg: "black" },
    apigateway: { bg: "magenta", fg: "white" },
    cloudfront: { bg: "yellow", fg: "black" },
    _resources: { bg: "white", fg: "black" },
    _regions: { bg: "blue", fg: "white" },
    _profiles: { bg: "magenta", fg: "white" },
  },
});

// ─── Catppuccin Mocha (256-color hex palette) ─────────────────────────────────
// https://github.com/catppuccin/catppuccin#-palette
// dimText: Overlay0 (#6c7086) for placeholder/inactive (subtler than Surface1)

const CATPPUCCIN_MOCHA_THEME = createTheme({
  bg: "#1e1e2e",           // Base
  subtle: "#45475a",       // Surface1
  rowSelectedBg: "#313244", // Surface0
  navigationBg: "#89b4fa",  // Blue
  navigationFg: "#1e1e2e",  // Base (dark text on light nav)
  text: "#cdd6f4",         // Text
  brand: "#cba6f7",        // Mauve
  data: "#f9e2af",         // Yellow
  structure: "#89dceb",    // Sky
  location: "#a6e3a1",     // Green
  danger: "#f38ba8",       // Red
  dimText: "#6c7086",      // Overlay0
  serviceColors: {
    s3: { bg: "#f38ba8", fg: "#1e1e2e" },
    iam: { bg: "#89b4fa", fg: "#1e1e2e" },
    secretsmanager: { bg: "#cba6f7", fg: "#1e1e2e" },
    route53: { bg: "#89dceb", fg: "#1e1e2e" },
    dynamodb: { bg: "#a6e3a1", fg: "#1e1e2e" },
    ec2: { bg: "#fab387", fg: "#1e1e2e" },
    lambda: { bg: "#94e2d5", fg: "#1e1e2e" },
    ecs: { bg: "#b4befe", fg: "#1e1e2e" },
    cloudwatch: { bg: "#eba0ac", fg: "#1e1e2e" },
    ebs: { bg: "#f9e2af", fg: "#1e1e2e" },
    elb: { bg: "#74c7ec", fg: "#1e1e2e" },
    rds: { bg: "#f38ba8", fg: "#1e1e2e" },
    sqs: { bg: "#a6e3a1", fg: "#1e1e2e" },
    cloudformation: { bg: "#fab387", fg: "#1e1e2e" },
    sns: { bg: "#f38ba8", fg: "#1e1e2e" },
    ssm: { bg: "#89dceb", fg: "#1e1e2e" },
    vpc: { bg: "#89b4fa", fg: "#1e1e2e" },
    ecr: { bg: "#cba6f7", fg: "#1e1e2e" },
    stepfunctions: { bg: "#89dceb", fg: "#1e1e2e" },
    eventbridge: { bg: "#f9e2af", fg: "#1e1e2e" },
    apigateway: { bg: "#cba6f7", fg: "#1e1e2e" },
    cloudfront: { bg: "#fab387", fg: "#1e1e2e" },
    _resources: { bg: "#cdd6f4", fg: "#1e1e2e" },
    _regions: { bg: "#89b4fa", fg: "#1e1e2e" },
    _profiles: { bg: "#cba6f7", fg: "#1e1e2e" },
  },
});

// ─── Nord ─────────────────────────────────────────────────────────────────────
// https://www.nordtheme.com/docs/colors-and-palettes

const NORD_THEME = createTheme({
  bg: "#2e3440",           // Polar Night 0
  subtle: "#4c566a",       // Polar Night 3
  rowSelectedBg: "#3b4252", // Polar Night 1
  navigationBg: "#5e81ac",  // Frost Dark Blue
  navigationFg: "#eceff4",  // Snow Storm 2
  text: "#eceff4",         // Snow Storm 2
  brand: "#b48ead",        // Aurora Purple
  data: "#ebcb8b",         // Aurora Yellow
  structure: "#88c0d0",    // Frost Blue
  location: "#a3be8c",     // Aurora Green
  danger: "#bf616a",       // Aurora Red
  serviceColors: {
    s3: { bg: "#bf616a", fg: "#eceff4" },
    iam: { bg: "#5e81ac", fg: "#eceff4" },
    secretsmanager: { bg: "#b48ead", fg: "#eceff4" },
    route53: { bg: "#88c0d0", fg: "#2e3440" },
    dynamodb: { bg: "#a3be8c", fg: "#2e3440" },
    ec2: { bg: "#d08770", fg: "#2e3440" },
    lambda: { bg: "#8fbcbb", fg: "#2e3440" },
    ecs: { bg: "#81a1c1", fg: "#eceff4" },
    cloudwatch: { bg: "#ebcb8b", fg: "#2e3440" },
    ebs: { bg: "#ebcb8b", fg: "#2e3440" },
    elb: { bg: "#5e81ac", fg: "#eceff4" },
    rds: { bg: "#bf616a", fg: "#eceff4" },
    sqs: { bg: "#a3be8c", fg: "#2e3440" },
    cloudformation: { bg: "#d08770", fg: "#2e3440" },
    sns: { bg: "#bf616a", fg: "#eceff4" },
    ssm: { bg: "#8fbcbb", fg: "#2e3440" },
    vpc: { bg: "#5e81ac", fg: "#eceff4" },
    ecr: { bg: "#b48ead", fg: "#eceff4" },
    stepfunctions: { bg: "#8fbcbb", fg: "#2e3440" },
    eventbridge: { bg: "#ebcb8b", fg: "#2e3440" },
    apigateway: { bg: "#b48ead", fg: "#eceff4" },
    cloudfront: { bg: "#d08770", fg: "#2e3440" },
    _resources: { bg: "#eceff4", fg: "#2e3440" },
    _regions: { bg: "#5e81ac", fg: "#eceff4" },
    _profiles: { bg: "#b48ead", fg: "#eceff4" },
  },
});

// ─── Tokyo Night ──────────────────────────────────────────────────────────────
// https://github.com/folke/tokyonight.nvim

const TOKYO_NIGHT_THEME = createTheme({
  bg: "#1a1b26",
  subtle: "#414868",       // terminal_black
  rowSelectedBg: "#292e42", // bg_highlight
  navigationBg: "#7aa2f7",  // blue
  navigationFg: "#1a1b26",  // bg (dark text on light nav)
  text: "#c0caf5",         // fg
  brand: "#bb9af7",        // magenta/purple
  data: "#e0af68",         // yellow
  structure: "#7dcfff",    // cyan
  location: "#9ece6a",     // green
  danger: "#f7768e",       // red
  serviceColors: {
    s3: { bg: "#f7768e", fg: "#1a1b26" },
    iam: { bg: "#7aa2f7", fg: "#1a1b26" },
    secretsmanager: { bg: "#bb9af7", fg: "#1a1b26" },
    route53: { bg: "#7dcfff", fg: "#1a1b26" },
    dynamodb: { bg: "#9ece6a", fg: "#1a1b26" },
    ec2: { bg: "#ff9e64", fg: "#1a1b26" },
    lambda: { bg: "#73daca", fg: "#1a1b26" },
    ecs: { bg: "#9d7cd8", fg: "#1a1b26" },
    cloudwatch: { bg: "#2ac3de", fg: "#1a1b26" },
    ebs: { bg: "#e0af68", fg: "#1a1b26" },
    elb: { bg: "#7aa2f7", fg: "#1a1b26" },
    rds: { bg: "#f7768e", fg: "#1a1b26" },
    sqs: { bg: "#9ece6a", fg: "#1a1b26" },
    cloudformation: { bg: "#ff9e64", fg: "#1a1b26" },
    sns: { bg: "#f7768e", fg: "#1a1b26" },
    ssm: { bg: "#73daca", fg: "#1a1b26" },
    vpc: { bg: "#7aa2f7", fg: "#1a1b26" },
    ecr: { bg: "#bb9af7", fg: "#1a1b26" },
    stepfunctions: { bg: "#73daca", fg: "#1a1b26" },
    eventbridge: { bg: "#e0af68", fg: "#1a1b26" },
    apigateway: { bg: "#bb9af7", fg: "#1a1b26" },
    cloudfront: { bg: "#ff9e64", fg: "#1a1b26" },
    _resources: { bg: "#c0caf5", fg: "#1a1b26" },
    _regions: { bg: "#7aa2f7", fg: "#1a1b26" },
    _profiles: { bg: "#bb9af7", fg: "#1a1b26" },
  },
});

// ─── Gruvbox Dark ─────────────────────────────────────────────────────────────
// https://github.com/morhetz/gruvbox

const GRUVBOX_DARK_THEME = createTheme({
  bg: "#282828",
  subtle: "#665c54",       // bg3
  rowSelectedBg: "#3c3836", // bg1
  navigationBg: "#458588",  // blue
  navigationFg: "#ebdbb2",  // fg (light text on teal nav)
  text: "#ebdbb2",         // fg
  brand: "#d3869b",        // bright purple
  data: "#fabd2f",         // bright yellow
  structure: "#83a598",    // bright blue
  location: "#b8bb26",     // bright green
  danger: "#fb4934",       // bright red
  serviceColors: {
    s3: { bg: "#fb4934", fg: "#282828" },
    iam: { bg: "#83a598", fg: "#282828" },
    secretsmanager: { bg: "#d3869b", fg: "#282828" },
    route53: { bg: "#8ec07c", fg: "#282828" },
    dynamodb: { bg: "#b8bb26", fg: "#282828" },
    ec2: { bg: "#fe8019", fg: "#282828" },
    lambda: { bg: "#689d6a", fg: "#ebdbb2" },
    ecs: { bg: "#d79921", fg: "#282828" },
    cloudwatch: { bg: "#458588", fg: "#ebdbb2" },
    ebs: { bg: "#fabd2f", fg: "#282828" },
    elb: { bg: "#83a598", fg: "#282828" },
    rds: { bg: "#fb4934", fg: "#282828" },
    sqs: { bg: "#b8bb26", fg: "#282828" },
    cloudformation: { bg: "#fe8019", fg: "#282828" },
    sns: { bg: "#fb4934", fg: "#282828" },
    ssm: { bg: "#8ec07c", fg: "#282828" },
    vpc: { bg: "#83a598", fg: "#282828" },
    ecr: { bg: "#d3869b", fg: "#282828" },
    stepfunctions: { bg: "#8ec07c", fg: "#282828" },
    eventbridge: { bg: "#fabd2f", fg: "#282828" },
    apigateway: { bg: "#d3869b", fg: "#282828" },
    cloudfront: { bg: "#fe8019", fg: "#282828" },
    _resources: { bg: "#ebdbb2", fg: "#282828" },
    _regions: { bg: "#458588", fg: "#ebdbb2" },
    _profiles: { bg: "#d3869b", fg: "#282828" },
  },
});

// ─── Dracula ──────────────────────────────────────────────────────────────────
// https://draculatheme.com/contribute
// Note: upload border/title uses data (yellow) rather than Dracula orange (#ffb86c)

const DRACULA_THEME = createTheme({
  bg: "#282a36",
  subtle: "#6272a4",       // Comment
  rowSelectedBg: "#44475a", // Current Line
  navigationBg: "#bd93f9",  // Purple
  navigationFg: "#282a36",  // bg (dark text on light nav)
  text: "#f8f8f2",         // Foreground
  brand: "#ff79c6",        // Pink
  data: "#f1fa8c",         // Yellow
  structure: "#8be9fd",    // Cyan
  location: "#50fa7b",     // Green
  danger: "#ff5555",       // Red
  serviceColors: {
    s3: { bg: "#ff5555", fg: "#282a36" },
    iam: { bg: "#bd93f9", fg: "#282a36" },
    secretsmanager: { bg: "#ff79c6", fg: "#282a36" },
    route53: { bg: "#8be9fd", fg: "#282a36" },
    dynamodb: { bg: "#50fa7b", fg: "#282a36" },
    ec2: { bg: "#ffb86c", fg: "#282a36" },
    lambda: { bg: "#f1fa8c", fg: "#282a36" },
    ecs: { bg: "#6272a4", fg: "#f8f8f2" },
    cloudwatch: { bg: "#ff79c6", fg: "#282a36" },
    ebs: { bg: "#f1fa8c", fg: "#282a36" },
    elb: { bg: "#8be9fd", fg: "#282a36" },
    rds: { bg: "#ff5555", fg: "#282a36" },
    sqs: { bg: "#50fa7b", fg: "#282a36" },
    cloudformation: { bg: "#ffb86c", fg: "#282a36" },
    sns: { bg: "#ff5555", fg: "#282a36" },
    ssm: { bg: "#8be9fd", fg: "#282a36" },
    vpc: { bg: "#bd93f9", fg: "#282a36" },
    ecr: { bg: "#ff79c6", fg: "#282a36" },
    stepfunctions: { bg: "#8be9fd", fg: "#282a36" },
    eventbridge: { bg: "#f1fa8c", fg: "#282a36" },
    apigateway: { bg: "#ff79c6", fg: "#282a36" },
    cloudfront: { bg: "#ffb86c", fg: "#282a36" },
    _resources: { bg: "#f8f8f2", fg: "#282a36" },
    _regions: { bg: "#bd93f9", fg: "#282a36" },
    _profiles: { bg: "#ff79c6", fg: "#282a36" },
  },
});

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
