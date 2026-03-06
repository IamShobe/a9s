import { useState, useCallback } from "react";
import type { HelpTab } from "../components/HelpPanel.js";

export function useHelpPanel(helpTabs: HelpTab[], helpContainerHeight: number) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTabIndex, setHelpTabIndex] = useState(0);
  const [helpScrollOffset, setHelpScrollOffset] = useState(0);

  const helpTabsCount = helpTabs.length;

  // Compute visible rows from container height and current tab
  const baseHelpVisibleRows = Math.max(1, helpContainerHeight - 3);
  const activeHelpItemsCount = helpTabs[helpTabIndex]?.items.length ?? 0;
  const overflowRows = Math.max(0, activeHelpItemsCount - baseHelpVisibleRows);
  const scrollReserveRows = Math.min(3, overflowRows);
  const helpVisibleRows =
    overflowRows > 0
      ? Math.max(1, baseHelpVisibleRows - scrollReserveRows - 1)
      : Math.max(1, baseHelpVisibleRows - 1);

  const clampTab = useCallback(
    (idx: number) => ((idx % helpTabsCount) + helpTabsCount) % helpTabsCount,
    [helpTabsCount],
  );

  const open = useCallback(() => {
    setHelpScrollOffset(0);
    setHelpTabIndex(0);
    setHelpOpen(true);
  }, []);

  const openAtTab = useCallback(
    (idx: number) => {
      setHelpScrollOffset(0);
      setHelpTabIndex(clampTab(idx));
      setHelpOpen(true);
    },
    [clampTab],
  );

  const close = useCallback(() => setHelpOpen(false), []);

  const scrollUp = useCallback(() => setHelpScrollOffset((prev) => Math.max(0, prev - 1)), []);

  const scrollDown = useCallback(() => {
    const maxOffset = Math.max(0, (helpTabs[helpTabIndex]?.items.length ?? 0) - helpVisibleRows);
    setHelpScrollOffset((prev) => Math.min(maxOffset, prev + 1));
  }, [helpTabs, helpTabIndex, helpVisibleRows]);

  const goToPrevTab = useCallback(() => {
    setHelpScrollOffset(0);
    setHelpTabIndex((prev) => clampTab(prev - 1));
  }, [clampTab]);

  const goToNextTab = useCallback(() => {
    setHelpScrollOffset(0);
    setHelpTabIndex((prev) => clampTab(prev + 1));
  }, [clampTab]);

  /** Returns true if a numeric tab was selected */
  const goToTab = useCallback(
    (input: string): boolean => {
      if (input.length !== 1) return false;
      const num = Number.parseInt(input, 10);
      if (Number.isNaN(num) || num < 1 || num > helpTabsCount) return false;
      setHelpScrollOffset(0);
      setHelpTabIndex(num - 1);
      return true;
    },
    [helpTabsCount],
  );

  return {
    helpOpen,
    helpTabIndex,
    helpScrollOffset,
    helpVisibleRows,
    open,
    openAtTab,
    close,
    scrollUp,
    scrollDown,
    goToPrevTab,
    goToNextTab,
    goToTab,
  };
}

export type HelpPanelState = ReturnType<typeof useHelpPanel>;
