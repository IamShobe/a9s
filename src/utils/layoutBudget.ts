export function computeOuterChrome(opts: {
  hasPendingPrompt: boolean;
  hasPendingConfirm: boolean;
}): number {
  const HUD = 3;
  const FEEDBACK = 1;
  const MODEBAR = 1;
  let total = HUD + FEEDBACK + MODEBAR; // = 5
  if (opts.hasPendingPrompt) total += 1;
  if (opts.hasPendingConfirm) total += 1;
  return total;
}

export function computeTableDataRows(
  contentBudget: number,
  opts: {
    hasContextLabel: boolean;
    footerContentRows: number; // 0, 1, or 2
    totalRows: number;
  },
): number {
  let chrome = 2; // header + divider (always)
  if (opts.hasContextLabel) chrome += 2; // label + spacer
  if (opts.footerContentRows > 0) chrome += 1 + opts.footerContentRows; // divider + content

  // Two-pass pagination resolution
  const rowsWithout = Math.max(1, contentBudget - chrome);
  if (opts.totalRows <= rowsWithout) return rowsWithout; // no pagination needed
  return Math.max(1, contentBudget - chrome - 2); // pagination: paddingTop(1) + text(1)
}

export function computeSearchHistoryLines(
  showSearchHistory: boolean,
  historyLength: number,
): number {
  if (!showSearchHistory || historyLength === 0) return 0;
  return Math.min(historyLength, 5) + 2; // entries + border top/bottom
}
