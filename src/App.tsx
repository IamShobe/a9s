import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp } from "ink";
import { useAtom, useSetAtom } from "jotai";
import clipboardy from "clipboardy";

import { HUD } from "./components/HUD.js";
import { ModeBar } from "./components/ModeBar.js";
import { AdvancedTextInput } from "./components/AdvancedTextInput.js";
import { FullscreenBox, useScreenSize } from "./utils/withFullscreen.js";
import { useHelpPanel } from "./hooks/useHelpPanel.js";
import { useAwsContext } from "./hooks/useAwsContext.js";
import { useAwsRegions } from "./hooks/useAwsRegions.js";
import { useAwsProfiles } from "./hooks/useAwsProfiles.js";
import { useMainInput } from "./hooks/useMainInput.js";
import { useInputEventProcessor } from "./hooks/useInputEventProcessor.js";
import { useAppController } from "./hooks/useAppController.js";
import { useCommandRouter } from "./hooks/useCommandRouter.js";
import { useAdapterStack } from "./hooks/useAdapterStack.js";
import { useDetailController } from "./hooks/useDetailController.js";
import { useActionController } from "./hooks/useActionController.js";
import { useUiHints } from "./hooks/useUiHints.js";
import { useAppData } from "./hooks/useAppData.js";
import { useTableLayout } from "./hooks/useTableLayout.js";
import { computeOuterChrome } from "./utils/layoutBudget.js";
import { deriveYankHeaderMarkers } from "./hooks/yankHeaderMarkers.js";
import { AppMainView } from "./features/AppMainView.js";
import type { ServiceId } from "./services.js";
import type { ServiceViewResult, TableRow } from "./types.js";
import { getCellLabel } from "./types.js";
import { computeColumnWidths } from "./components/Table/widths.js";
import { truncateNoPad } from "./utils/textUtils.js";
import type { RelatedResource } from "./adapters/ServiceAdapter.js";
import { AVAILABLE_COMMANDS } from "./constants/commands.js";
import { buildHelpTabs, triggerToString } from "./constants/keybindings.js";
import type { InputRuntimeState } from "./hooks/inputEvents.js";
import { useTheme } from "./contexts/ThemeContext.js";
import { saveConfig } from "./utils/config.js";
import { readFile } from "fs/promises";
import { openConsoleUrl } from "./utils/consoleUrl.js";
import { runAwsJsonAsync } from "./utils/aws.js";
import { debugLog } from "./utils/debugLogger.js";
import { loadSearchHistory, saveSearchEntry } from "./utils/searchHistory.js";
import { loadBookmarks, toggleBookmark } from "./utils/bookmarks.js";
import { buildHistogram } from "./utils/histogram.js";
import type { HistogramBar } from "./utils/histogram.js";
import { useFilePreview } from "./hooks/useFilePreview.js";
import { MIN_COL_WIDTH, GAP } from "./components/FilePreviewPanel.js";
import {
  currentlySelectedServiceAtom,
  selectedRegionAtom,
  selectedProfileAtom,
  revealSecretsAtom,
  themeNameAtom,
  bookmarkRestoreAtom,
} from "./state/atoms.js";
import type { ThemeName } from "./constants/theme.js";

const INITIAL_AWS_PROFILE = process.env.AWS_PROFILE;

/** Convert a theme color to a hex string for OSC 11. Named colors → hex. */
function toOscColor(color: string): string {
  if (color.startsWith('#')) return color;
  const named: Record<string, string> = {
    black: '#000000', white: '#ffffff', red: '#cc0000',
    green: '#00cc00', blue: '#0000cc', cyan: '#00cccc',
    magenta: '#cc00cc', yellow: '#cccc00', gray: '#808080',
  };
  return named[color] ?? '#000000';
}

interface AppProps {
  endpointUrl: string | undefined;
}

export function App({ endpointUrl }: AppProps) {
  const { exit } = useApp();
  const { columns: termCols, rows: termRows } = useScreenSize();

  const theme = useTheme();
  const adapterStack = useAdapterStack();
  const [currentService, setCurrentService] = useAtom(currentlySelectedServiceAtom);
  const [selectedRegion, setSelectedRegion] = useAtom(selectedRegionAtom);
  const [selectedProfile, setSelectedProfile] = useAtom(selectedProfileAtom);
  const [revealSecrets, setRevealSecrets] = useAtom(revealSecretsAtom);
  const [themeName, setThemeName] = useAtom(themeNameAtom);

  // Paint the terminal's default background so uncolored cells (border chars, gaps) inherit the theme
  useEffect(() => {
    process.stdout.write(`\x1b]11;${toOscColor(theme.global.mainBg)}\x07`);
    return () => {
      process.stdout.write(`\x1b]111\x07`); // restore original background on unmount
    };
  }, [theme.global.mainBg]);

  // Live theme preview: refs to restore original when picker is cancelled
  const themeNameRef = useRef(themeName);
  themeNameRef.current = themeName; // always in sync, not a dep
  const originalThemeRef = useRef(themeName);
  const themePickerConfirmedRef = useRef(false);

  const { accountName, accountId, awsProfile, currentIdentity, region } = useAwsContext(
    endpointUrl,
    selectedRegion,
    selectedProfile,
  );
  const availableRegions = useAwsRegions(selectedRegion, selectedProfile);
  const availableProfiles = useAwsProfiles();

  const { state, actions, yankFeedbackMessage } = useAppController();

  useEffect(() => {
    if (selectedProfile === "$default") {
      if (INITIAL_AWS_PROFILE === undefined) {
        delete process.env.AWS_PROFILE;
      } else {
        process.env.AWS_PROFILE = INITIAL_AWS_PROFILE;
      }
      return;
    }
    process.env.AWS_PROFILE = selectedProfile;
  }, [selectedProfile]);

  // Related resources state — populated when user presses g+r on a row (must be declared before useAppData)
  const [relatedResources, setRelatedResources] = useState<RelatedResource[]>([]);

  // Tag filter state — set via :tag Key=Value command
  const [tagFilter, setTagFilterState] = useState<{ key: string; value: string } | null>(null);

  // Sort state — null = no sort; S cycles through columns and directions
  const [sortState, setSortState] = useState<{ colKey: string; dir: "asc" | "desc" } | null>(null);

  // Heatmap state
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);

  // Multi-select state
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const lastToggledIndexRef = useRef<number>(-1);

  // Bookmark state
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => {
    const entries = loadBookmarks();
    return new Set(entries.filter((e) => e.serviceId === currentService).map((e) => e.rowId));
  });

  // Search history state
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [searchHistoryIndex, setSearchHistoryIndex] = useState(-1);
  const [showSearchHistory, setShowSearchHistory] = useState(false);

  // Histogram state
  const [histogramState, setHistogramState] = useState<{ columnKey: string; columnLabel: string; bars: HistogramBar[] | null } | null>(null);

  const {
    adapter,
    columns,
    isLoading,
    error,
    select,
    edit,
    goBack,
    refresh,
    path,
    filteredRows,
  } = useAppData({
    currentService,
    endpointUrl,
    selectedRegion,
    filterText: state.filterText,
    availableRegions,
    availableProfiles,
    tagFilter,
    sortState,
    heatmapEnabled,
    bookmarkedIds,
  });

  const contentBudget = termRows - computeOuterChrome({
    hasPendingPrompt: state.pendingAction?.effect.type === "prompt",
    hasPendingConfirm: state.pendingAction?.effect.type === "confirm",
  });

  const {
    dataRows,
    navigation,
    selectedRow,
    pickers,
    statusSummary,
  } = useTableLayout({
    contentBudget,
    adapter,
    filteredRows,
    showSearchHistory,
    searchHistoryLength: searchHistory.length,
    relatedResources,
  });

  // File preview state
  const filePreview = useFilePreview(contentBudget);

  // Ref for restoring cursor position after adapter pop
  const pendingIndexRef = useRef<number | null>(null);
  // Ref for highlighting a specific row by ID after bookmark restore
  const pendingRowIdRef = useRef<string | null>(null);

  // Stable refs so jumpToBookmark can call refresh/currentService without stale closures
  const currentServiceRef = useRef(currentService);
  currentServiceRef.current = currentService;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const setBookmarkRestore = useSetAtom(bookmarkRestoreAtom);

  // Restore cursor position when rows become available after adapter switch
  useEffect(() => {
    if (pendingRowIdRef.current !== null && filteredRows.length > 0) {
      const idx = filteredRows.findIndex((r) => r.id === pendingRowIdRef.current);
      navigation.setIndex(idx >= 0 ? idx : 0);
      pendingRowIdRef.current = null;
    } else if (pendingIndexRef.current !== null && filteredRows.length > 0) {
      navigation.setIndex(Math.min(pendingIndexRef.current, filteredRows.length - 1));
      pendingIndexRef.current = null;
    }
  }, [filteredRows.length, navigation]);

  // Refresh bookmarked IDs when service changes
  useEffect(() => {
    const entries = loadBookmarks();
    setBookmarkedIds(new Set(
      entries.filter((e) => e.serviceId === currentService).map((e) => e.rowId)
    ));
  }, [currentService]);

  // Load search history on service switch
  useEffect(() => {
    setSearchHistory(loadSearchHistory(currentService));
    setSearchHistoryIndex(-1);
    setShowSearchHistory(false);
  }, [currentService]);

  // Save original theme when theme picker opens; restore it if picker is cancelled
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pickers.theme.open) {
      originalThemeRef.current = themeNameRef.current;
      themePickerConfirmedRef.current = false;
    } else if (!themePickerConfirmedRef.current) {
      setThemeName(originalThemeRef.current);
    }
  }, [pickers.theme.open]);

  // Live preview: apply hovered theme immediately as selection changes
  useEffect(() => {
    if (!pickers.theme.open || !pickers.theme.selectedRow) return;
    setThemeName(pickers.theme.selectedRow.id as ThemeName);
  }, [pickers.theme.open, pickers.theme.selectedRow, setThemeName]);

  // Watch mode — declared before switchAdapter which references setWatchInterval
  const [watchInterval, setWatchInterval] = useState<number | null>(null);
  const watchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (watchTimerRef.current) {
      clearTimeout(watchTimerRef.current);
      watchTimerRef.current = null;
    }
    if (watchInterval == null) return;
    const schedule = () => {
      watchTimerRef.current = setTimeout(() => {
        void refresh();
        schedule();
      }, watchInterval * 1000);
    };
    schedule();
    return () => {
      if (watchTimerRef.current) clearTimeout(watchTimerRef.current);
    };
  }, [watchInterval, refresh]);

  const resetViewState = useCallback(() => {
    actions.setFilterText("");
    actions.setDescribeState(null);
    actions.setSearchEntryFilter(null);
    actions.setMode("navigate");
    actions.setYankMode(false);
    actions.setUploadPending(null);
    actions.setPendingAction(null);
    setWatchInterval(null);
    setTagFilterState(null);
    setSortState(null);
    setSelectedRowIds(new Set());
    lastToggledIndexRef.current = -1;
    setHistogramState(null);
    navigation.reset();
  }, [actions, navigation]);

  const switchAdapter = useCallback(
    (serviceId: ServiceId) => {
      if (serviceId === "_resources") {
        // Resources is always the root — clear the stack so back stops here
        adapterStack.clear();
      } else {
        adapterStack.push({ adapterId: currentService, filterText: state.filterText, selectedIndex: navigation.selectedIndex });
      }
      setCurrentService(serviceId);
      resetViewState();
    },
    [resetViewState, navigation, setCurrentService, adapterStack, currentService, state.filterText],
  );

  /** Jump to a bookmarked item: clears the adapter stack + defers level restore. */
  const jumpToBookmark = useCallback(
    (entry: import("./utils/bookmarks.js").BookmarkEntry) => {
      if (entry.key.length > 1) {
        // Set atom for both same-service and cross-service — performFetch consumes it
        setBookmarkRestore({ serviceId: entry.serviceId, key: entry.key });
        if (entry.serviceId === currentServiceRef.current) {
          // Same-service: adapter won't recreate, no useEffect fires — trigger fetch manually
          void refreshRef.current();
        }
        // Cross-service: setCurrentService below triggers adapter recreation → useEffect → performFetch
      }
      adapterStack.clear();
      setCurrentService(entry.serviceId as ServiceId);
      pendingRowIdRef.current = entry.rowId;
      resetViewState();
    },
    [resetViewState, setCurrentService, adapterStack, setBookmarkRestore],
  );

  const popBackToCallingAdapter = useCallback(() => {
    const frame = adapterStack.pop();
    if (!frame) return;
    setCurrentService(frame.adapterId);
    actions.setFilterText(frame.filterText);
    actions.setMode("navigate");
    pendingIndexRef.current = frame.selectedIndex;
  }, [adapterStack, setCurrentService, actions]);

  const navigateBack = useCallback(() => {
    if (adapter.canGoBack()) {
      // Intra-adapter back (e.g., S3 objects → buckets)
      void goBack().then((restored) => {
        actions.setDescribeState(null);
        actions.setSearchEntryFilter(null);
        actions.setFilterText(restored?.filterText ?? "");
        navigation.setIndex(restored?.selectedIndex ?? 0);
      });
      return;
    }
    // Inter-adapter back: pop the stack
    if (adapterStack.isEmpty) return; // at root (_resources)
    popBackToCallingAdapter();
  }, [actions, adapter, goBack, navigation, adapterStack.isEmpty, popBackToCallingAdapter]);

  const navigateIntoSelection = useCallback(() => {
    if (!selectedRow) return;

    // Resource adapter: enter = switch to selected service
    if (currentService === "_resources") {
      switchAdapter(selectedRow.id as ServiceId);
      return;
    }
    // Region adapter: enter = set region + pop back
    if (currentService === "_regions") {
      setSelectedRegion(selectedRow.id);
      popBackToCallingAdapter();
      return;
    }
    // Profile adapter: enter = set profile + pop back
    if (currentService === "_profiles") {
      setSelectedProfile(selectedRow.id);
      popBackToCallingAdapter();
      return;
    }

    if (selectedRow.meta?.type === "object") {
      if (adapter.capabilities?.preview?.canPreview(selectedRow)) {
        filePreview.showPreview(selectedRow, adapter);
      }
      return;
    }
    const capturedFilter = state.filterText;
    const capturedIndex = navigation.selectedIndex;
    void select(selectedRow).then((result: ServiceViewResult) => {
      if (result?.action === "navigate") {
        actions.setSearchEntryFilter(null);
        adapter.pushUiLevel(capturedFilter, capturedIndex);
        actions.setFilterText("");
        actions.setDescribeState(null);
        navigation.reset();
        return;
      }
      if (result.action === "edit" && "needsUpload" in result && result.needsUpload) {
        actions.setUploadPending({
          filePath: result.filePath,
          metadata: result.metadata,
        });
      }
    });
  }, [actions, adapter, navigation, select, selectedRow, currentService, switchAdapter, setSelectedRegion, setSelectedProfile, popBackToCallingAdapter, state.filterText]);

  const editSelection = useCallback(() => {
    if (!selectedRow) return;
    void edit(selectedRow).then((result: ServiceViewResult) => {
      if (result.action === "edit" && "needsUpload" in result && result.needsUpload) {
        actions.setUploadPending({
          filePath: result.filePath,
          metadata: result.metadata,
        });
      }
    });
  }, [actions, edit, selectedRow]);

  const { showDetails: showDetailsBase, closeDetails } = useDetailController({
    adapter,
    setDescribeState: actions.setDescribeState,
  });

  const showDetails = useCallback(
    (row: TableRow | null) => {
      setPanelScrollOffset(0);
      showDetailsBase(row);
    },
    [showDetailsBase],
  );

  const { handleActionEffect, submitPendingAction } = useActionController({
    adapter,
    refresh,
    setPendingAction: actions.setPendingAction,
    pushFeedback: actions.pushFeedback,
  });

  const runAdapterAction = useCallback(
    (actionId: string, row: TableRow | null) => {
      if (!adapter.capabilities?.actions) return;
      void adapter.capabilities.actions
        .executeAction(actionId, { row })
        .then((effect) => {
          handleActionEffect(effect, row);
        })
        .catch((err) => {
          actions.pushFeedback(`Action failed: ${(err as Error).message}`, 3000);
        });
    },
    [actions, adapter.capabilities?.actions, handleActionEffect],
  );

  const adapterBindings = useMemo(
    () => adapter.capabilities?.actions?.getKeybindings() ?? [],
    [adapter],
  );

  // Compute context for keybinding hints (must precede helpTabs and useUiHints)
  const uiHintsContext = useMemo(() => {
    // Check if any visible row contains secret cells
    const hasSecretData = filteredRows.some((row) =>
      Object.values(row.cells).some((cell) => typeof cell === "object" && cell?.type === "secret"),
    );
    // Only show reveal toggle if there are secrets AND they're currently hidden
    const hasPreviewableRow = Boolean(
      selectedRow && adapter.capabilities?.preview?.canPreview(selectedRow),
    );
    return {
      hasHiddenSecrets: hasSecretData && !revealSecrets,
      hasPreviewableRow,
    };
  }, [filteredRows, revealSecrets, selectedRow, adapter]);

  const helpTabs = useMemo(
    () => buildHelpTabs(adapter.id, adapterBindings, uiHintsContext),
    [adapter.id, adapterBindings, uiHintsContext],
  );
  const helpContainerHeight = contentBudget;
  const helpPanel = useHelpPanel(helpTabs, helpContainerHeight);

  const nameOption = {
    trigger: { type: "key" as const, char: "n" },
    label: "copy name",
    feedback: "Copied Name",
    headerKey: "name",
    isRelevant: () => true,
    resolve: async (row: TableRow) => {
      const nameCell = row.cells.name;
      if (!nameCell) return null;
      return typeof nameCell === "string" ? nameCell : nameCell.displayName;
    },
  };

  const yankOptions = useMemo(() => {
    const adapterOptions = selectedRow
      ? (adapter.capabilities?.yank?.getYankOptions(selectedRow) ?? [])
      : [];
    return [nameOption, ...adapterOptions];
  }, [adapter, selectedRow]);

  const yankHint = useMemo(
    () =>
      [...yankOptions.map((o) => `${triggerToString(o.trigger)} · ${o.label}`), "Esc cancel"].join(
        " • ",
      ),
    [yankOptions],
  );
  const yankHeaderMarkers = useMemo(
    () => deriveYankHeaderMarkers(state.yankMode, yankOptions),
    [state.yankMode, yankOptions],
  );

  const { bottomHint } = useUiHints({
    mode: state.mode,
    helpOpen: helpPanel.helpOpen,
    pickers,
    pendingAction: state.pendingAction,
    uploadPending: state.uploadPending,
    describeState: state.describeState,
    yankMode: state.yankMode,
    adapterBindings,
    yankHint,
    context: uiHintsContext,
  });

  const commandRouter = useCommandRouter({
    setSelectedRegion,
    setSelectedProfile,
    switchAdapter,
    openThemePicker: () => pickers.openPicker("theme"),
    openBookmarksPicker: () => pickers.openPicker("bookmarks"),
    setWatch: (seconds: number) => {
      if (!currentService.startsWith("_")) setWatchInterval(seconds);
    },
    clearWatch: () => setWatchInterval(null),
    setTagFilter: (key, value) => setTagFilterState({ key, value }),
    clearTagFilter: () => setTagFilterState(null),
    exit,
  });

  const handleFilterChange = useCallback(
    (value: string) => {
      if (pickers.activePicker) {
        pickers.activePicker.setFilter(value);
        return;
      }
      if (value !== "" && showSearchHistory) setShowSearchHistory(false);
      setSearchHistoryIndex(-1);
      setSelectedRowIds(new Set());
      actions.setFilterText(value);
    },
    [actions, pickers, showSearchHistory],
  );

  const handleFilterSubmit = useCallback(() => {
    if (pickers.activePicker) {
      pickers.activePicker.confirmSearch();
      return;
    }
    if (state.filterText.trim()) {
      saveSearchEntry(currentService, state.filterText.trim());
      setSearchHistory(loadSearchHistory(currentService));
    }
    setShowSearchHistory(false);
    actions.setSearchEntryFilter(null);
    actions.setMode("navigate");
  }, [actions, pickers, state.filterText, currentService]);

  const handleCommandSubmit = useCallback(() => {
    const command = state.commandText.trim();
    if (command) {
      setCommandHistory((prev) => {
        const deduped = prev.filter((h) => h !== command);
        return [...deduped, command].slice(-200);
      });
    }
    commandHistoryIndexRef.current = -1;
    actions.setCommandText("");
    actions.setMode("navigate");
    commandRouter(command);
  }, [actions, commandRouter, state.commandText]);

  // Command history for ↑/↓ navigation in command mode
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const commandHistoryIndexRef = useRef(-1);

  const [uploadPreview, setUploadPreview] = useState<{
    old: string;
    new: string;
  }>({ old: "", new: "" });
  const [panelScrollOffset, setPanelScrollOffset] = useState(0);

  const handleUploadDecision = useCallback(
    (confirmed: boolean) => {
      if (!state.uploadPending) return;
      if (!confirmed) {
        actions.pushFeedback("Upload cancelled", 2000);
        actions.setUploadPending(null);
        setUploadPreview({ old: "", new: "" });
        return;
      }
      void (async () => {
        try {
          await adapter.capabilities?.edit?.uploadFile(
            state.uploadPending!.filePath,
            state.uploadPending!.metadata,
          );
          actions.pushFeedback("✓ Uploaded successfully", 2000);
          // Refresh to show updated data
          await refresh();
        } catch (err) {
          actions.pushFeedback(`✗ Upload failed: ${(err as Error).message}`, 3000);
        } finally {
          actions.setUploadPending(null);
          setUploadPreview({ old: "", new: "" });
        }
      })();
    },
    [actions, adapter.capabilities?.edit, state.uploadPending, refresh],
  );

  // Load preview when uploadPending changes
  useEffect(() => {
    if (!state.uploadPending) return;
    let cancelled = false;
    setPanelScrollOffset(0);
    void (async () => {
      try {
        const newContent = await readFile(state.uploadPending!.filePath, "utf-8");

        // Try to get old value from adapter (current value from AWS)
        let oldContent = "";
        const meta = state.uploadPending!.metadata;
        const regionArgs = selectedRegion ? ["--region", selectedRegion] : [];

        // For Secrets Manager fields: fetch the current field value
        if (meta.fieldKey && meta.secretArn) {
          try {
            const secretData = await runAwsJsonAsync<{
              SecretString?: string;
            }>([
              "secretsmanager",
              "get-secret-value",
              "--secret-id",
              meta.secretArn as string,
              ...regionArgs,
            ]);

            const secretString = secretData.SecretString || "";

            // $RAW field is the whole secret value, not a JSON field
            if (meta.fieldKey === "$RAW") {
              oldContent = secretString;
            } else {
              // Regular JSON field - parse and extract
              try {
                const parsed = JSON.parse(secretString);
                oldContent = parsed[meta.fieldKey as string] || "";
              } catch {
                // Not JSON - oldContent stays empty
              }
            }
          } catch (err) {
            debugLog("App", "upload preview fetch failed (field)", err);
          }
        }
        // For whole secrets: fetch current secret value
        else if (meta.secretArn && !meta.fieldKey) {
          try {
            const secretData = await runAwsJsonAsync<{
              SecretString?: string;
            }>([
              "secretsmanager",
              "get-secret-value",
              "--secret-id",
              meta.secretArn as string,
              ...regionArgs,
            ]);

            oldContent = secretData.SecretString || "";
          } catch (err) {
            debugLog("App", "upload preview fetch failed (secret)", err);
          }
        }

        if (!cancelled) setUploadPreview({ old: oldContent, new: newContent });
      } catch (err) {
        debugLog("App", "upload preview load failed", err);
        if (!cancelled) setUploadPreview({ old: "", new: "[Unable to load preview]" });
      }
    })();
    return () => { cancelled = true; };
  }, [state.uploadPending, selectedRegion]);

  const handleSortColumn = useCallback(() => {
    if (columns.length === 0) return;
    setSortState((prev) => {
      if (!prev) {
        return { colKey: columns[0]!.key, dir: "asc" };
      }
      if (prev.dir === "asc") {
        return { colKey: prev.colKey, dir: "desc" };
      }
      // desc → advance to next column, or clear if last
      const currentIdx = columns.findIndex((c) => c.key === prev.colKey);
      const nextIdx = currentIdx + 1;
      if (nextIdx < columns.length) {
        return { colKey: columns[nextIdx]!.key, dir: "asc" };
      }
      return null;
    });
  }, [columns]);

  const commandHistoryPrev = useCallback(() => {
    if (commandHistory.length === 0) return;
    const newIndex = Math.min(commandHistoryIndexRef.current + 1, commandHistory.length - 1);
    commandHistoryIndexRef.current = newIndex;
    actions.setCommandText(commandHistory[commandHistory.length - 1 - newIndex] ?? "");
    actions.bumpCommandCursorToEnd();
  }, [actions, commandHistory]);

  const commandHistoryNext = useCallback(() => {
    if (commandHistoryIndexRef.current <= 0) {
      commandHistoryIndexRef.current = -1;
      actions.setCommandText("");
      return;
    }
    const newIndex = commandHistoryIndexRef.current - 1;
    commandHistoryIndexRef.current = newIndex;
    actions.setCommandText(commandHistory[commandHistory.length - 1 - newIndex] ?? "");
    actions.bumpCommandCursorToEnd();
  }, [actions, commandHistory]);

  const commandAutocomplete = useCallback(() => {
    const match = AVAILABLE_COMMANDS.find((cmd) =>
      cmd.toLowerCase().startsWith(state.commandText.toLowerCase()),
    );
    if (!match) return;
    actions.setCommandText(match);
    actions.bumpCommandCursorToEnd();
  }, [actions, state.commandText]);

  const footerContent = useMemo(() => {
    const statusRow = statusSummary.byColor.length === 0 ? null : (() => {
      const parts: React.ReactNode[] = [
        <Text key="total" color={theme.table.columnHeaderText}> Total: {statusSummary.total}</Text>,
      ];
      for (const { color, count, label } of statusSummary.byColor) {
        parts.push(
          <Text key={color} color={color}> ● {label}: {count}</Text>
        );
      }
      return <Box flexDirection="row">{parts}</Box>;
    })();

    let previewRow: React.ReactNode = null;
    if (selectedRow) {
      const colWidths = computeColumnWidths(columns, termCols);
      const SEP = "  ·  "; // 5 chars
      // Collect segments that were truncated in the table
      const segments: { label: string; value: string }[] = [];
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i]!;
        const value = getCellLabel(selectedRow.cells[col.key]) ?? "";
        const width = colWidths[i] ?? 0;
        if (value.length > width - 1) {
          segments.push({ label: col.label, value });
        }
      }
      if (segments.length > 0) {
        // Budget-based rendering: fit as many segments as possible within termCols
        let budget = termCols;
        const fitted: React.ReactNode[] = [];
        for (const seg of segments) {
          const prefixLen = seg.label.length + 2; // "Label: "
          const sepCost = fitted.length > 0 ? SEP.length : 0;
          const minNeeded = sepCost + prefixLen + 1; // at least 1 char of value
          if (budget < minNeeded) break;

          if (fitted.length > 0) {
            fitted.push(<Text key={`sep-${fitted.length}`} color={theme.panel.detailFieldLabelText}>{SEP}</Text>);
            budget -= sepCost;
          }
          const valueSpace = budget - prefixLen;
          const displayValue = truncateNoPad(seg.value, valueSpace);
          fitted.push(
            <Text key={seg.label}>
              <Text color={theme.panel.detailFieldLabelText}>{seg.label}:</Text>
              {" "}{displayValue}
            </Text>
          );
          budget -= prefixLen + displayValue.length;
        }
        if (fitted.length > 0) {
          previewRow = <Box flexDirection="row">{fitted}</Box>;
        }
      }
    }

    if (!statusRow && !previewRow) return null;
    if (!previewRow) return statusRow;
    if (!statusRow) return previewRow;
    return <Box flexDirection="column">{statusRow}{previewRow}</Box>;
  }, [statusSummary, selectedRow, columns, termCols, theme.table.columnHeaderText, theme.panel.detailFieldLabelText]);

  const inputRuntime = useMemo<InputRuntimeState>(
    () => ({
      mode: state.mode,
      filterText: state.filterText,
      commandText: state.commandText,
      searchEntryFilter: state.searchEntryFilter,
      yankMode: state.yankMode,
      yankHelpOpen: state.yankHelpOpen,
      selectedRow,
      helpOpen: helpPanel.helpOpen,
      pickerMode: pickers.activePicker?.pickerMode ?? null,
      activePickerId: pickers.activePicker?.id ?? null,
      describeOpen: Boolean(state.describeState),
      uploadPending: Boolean(state.uploadPending),
      pendingActionType: state.pendingAction?.effect.type ?? null,
      histogramOpen: Boolean(histogramState),
      filePreviewOpen: Boolean(filePreview.previewState),
      previewFilterActive: filePreview.previewState?.filterActive ?? false,
      previewYankMode: filePreview.previewState?.previewYankMode ?? false,
    }),
    [helpPanel.helpOpen, pickers.activePicker?.pickerMode, selectedRow, state, histogramState, filePreview.previewState],
  );

  const inputDispatch = useInputEventProcessor({
    runtime: inputRuntime,
    actions: {
      app: { exit },
      help: {
        open: helpPanel.open,
        close: helpPanel.close,
        prevTab: helpPanel.goToPrevTab,
        nextTab: helpPanel.goToNextTab,
        scrollUp: helpPanel.scrollUp,
        scrollDown: helpPanel.scrollDown,
        goToTab: helpPanel.goToTab,
      },
      picker: {
        close: () => {
          if (pickers.activePicker?.id === "related") setRelatedResources([]);
          pickers.closeActivePicker();
        },
        cancelSearch: () => pickers.activePicker?.cancelSearch(),
        startSearch: () => pickers.activePicker?.startSearch(),
        moveDown: () => pickers.activePicker?.moveDown(),
        moveUp: () => pickers.activePicker?.moveUp(),
        top: () => pickers.activePicker?.toTop(),
        bottom: () => pickers.activePicker?.toBottom(),
        confirm: () =>
          pickers.confirmActivePickerSelection({
            onSelectTheme: (name: ThemeName) => {
              themePickerConfirmedRef.current = true;
              setThemeName(name);
              saveConfig({ theme: name });
            },
            onSelectRelated: (serviceId, filterHint) => {
              switchAdapter(serviceId);
              if (filterHint) actions.setFilterText(filterHint);
              setRelatedResources([]);
            },
            onSelectBookmark: (entry) => {
              jumpToBookmark(entry);
            },
          }),
        deleteItem: () => {
          const ap = pickers.activePicker;
          if (ap?.id !== "bookmarks" || !ap.selectedRow) return;
          const entry = ap.selectedRow.meta?.bookmarkEntry as import("./utils/bookmarks.js").BookmarkEntry | undefined;
          if (!entry) return;
          toggleBookmark(entry);
          if (entry.serviceId === currentService) {
            setBookmarkedIds((prev) => {
              const next = new Set(prev);
              next.delete(entry.rowId);
              return next;
            });
          }
          actions.pushFeedback("Removed bookmark", 1500);
          pickers.refreshPicker("bookmarks");
        },
      },
      mode: {
        cancelSearchOrCommand: () => {
          if (state.mode === "search") {
            if (state.searchEntryFilter !== null && state.filterText !== "") {
              handleFilterChange(state.searchEntryFilter);
            }
            actions.setSearchEntryFilter(null);
            setShowSearchHistory(false);
          }
          actions.setMode("navigate");
        },
        clearFilterOrNavigateBack: () => {
          if (selectedRowIds.size > 0) {
            setSelectedRowIds(new Set());
            return;
          }
          if (state.filterText !== "") {
            handleFilterChange("");
          } else {
            navigateBack();
          }
        },
        startSearch: () => {
          actions.setSearchEntryFilter(state.filterText);
          actions.setMode("search");
          setShowSearchHistory(true);
        },
        startCommand: () => {
          commandHistoryIndexRef.current = -1;
          actions.setCommandText("");
          actions.setMode("command");
        },
        commandAutocomplete,
        historyPrev: commandHistoryPrev,
        historyNext: commandHistoryNext,
      },
      navigation: {
        heatmapToggle: () => setHeatmapEnabled((v) => !v),
        multiSelectToggle: () => {
          if (!selectedRow) return;
          setSelectedRowIds((prev) => {
            const next = new Set(prev);
            if (next.has(selectedRow.id)) {
              next.delete(selectedRow.id);
            } else {
              next.add(selectedRow.id);
            }
            lastToggledIndexRef.current = navigation.selectedIndex;
            return next;
          });
        },
        multiSelectRange: () => {
          if (!selectedRow) return;
          const anchor = lastToggledIndexRef.current;
          const current = navigation.selectedIndex;
          if (anchor === -1) {
            setSelectedRowIds((prev) => {
              const next = new Set(prev);
              next.add(selectedRow.id);
              return next;
            });
            lastToggledIndexRef.current = current;
            return;
          }
          const lo = Math.min(anchor, current);
          const hi = Math.max(anchor, current);
          setSelectedRowIds((prev) => {
            const next = new Set(prev);
            filteredRows.slice(lo, hi + 1).forEach((r) => next.add(r.id));
            return next;
          });
        },
        multiSelectAll: () => {
          setSelectedRowIds(new Set(filteredRows.map((r) => r.id)));
        },
        bookmarkToggle: () => {
          if (!selectedRow) return;
          const added = toggleBookmark({
            serviceId: currentService,
            rowId: selectedRow.id,
            key: adapter.getBookmarkKey(selectedRow),
            savedAt: new Date().toISOString(),
          });
          setBookmarkedIds((prev) => {
            const next = new Set(prev);
            if (added) next.add(selectedRow.id); else next.delete(selectedRow.id);
            return next;
          });
          actions.pushFeedback(added ? `★ Bookmarked` : `Removed bookmark`, 1500);
        },
        showHistogram: () => {
          const numericCols = columns.filter((c) => c.heatmap && c.heatmap.type !== "date");
          const fallback = numericCols[0] ?? columns[1];

          let targetCol: typeof columns[number] | undefined;

          if (histogramState) {
            // Already open → cycle to next numeric column
            const currentIdx = numericCols.findIndex((c) => c.key === histogramState.columnKey);
            targetCol = numericCols[(currentIdx + 1) % numericCols.length] ?? fallback;
          } else {
            // Opening → prefer currently sorted column if numeric
            const sortedCol = sortState ? numericCols.find((c) => c.key === sortState.colKey) : undefined;
            targetCol = sortedCol ?? fallback;
          }

          if (!targetCol) return;
          const values = filteredRows.map((r) => r.cells[targetCol!.key]?.displayName ?? "");
          const bars = buildHistogram(values);
          setHistogramState({ columnKey: targetCol.key, columnLabel: targetCol.label, bars });
        },
        sortColumn: handleSortColumn,
        openInBrowser: () => {
          if (!selectedRow) return;
          const url = adapter.getBrowserUrl?.(selectedRow) ?? null;
          if (!url) {
            actions.pushFeedback("No console URL for this resource", 2000);
            return;
          }
          void openConsoleUrl(url, selectedProfile).then(() => {
            actions.pushFeedback("Opened in browser", 2000);
          });
        },
        refresh: () => {
          void refresh();
        },
        revealToggle: () => {
          setRevealSecrets(!revealSecrets);
        },
        previewFile: () => {
          // Now handled by Enter (navigateIntoSelection)
        },
        showDetails: () => showDetails(selectedRow),
        editSelection,
        top: navigation.toTop,
        bottom: navigation.toBottom,
        enter: navigateIntoSelection,
        jumpToRelated: () => {
          if (!selectedRow) return;
          void Promise.resolve(adapter.getRelatedResources?.(selectedRow) ?? []).then((resources) => {
            if (resources.length === 0) {
              actions.pushFeedback("No related resources", 2000);
              return;
            }
            setRelatedResources(resources);
            if (resources.length === 1) {
              // Jump directly if there's only one option
              const r = resources[0];
              switchAdapter(r.serviceId as ServiceId);
              if (r.filterHint) actions.setFilterText(r.filterHint);
              setRelatedResources([]);
              return;
            }
            // Multiple options — open picker
            pickers.openPicker("related");
          });
        },
      },
      scroll: {
        up: () => {
          if (state.uploadPending || state.describeState) {
            setPanelScrollOffset((p) => Math.max(0, p - 1));
          } else {
            navigation.moveUp();
          }
        },
        down: () => {
          if (state.uploadPending || state.describeState) {
            setPanelScrollOffset((p) => p + 1);
          } else {
            navigation.moveDown();
          }
        },
      },
      yank: {
        enter: () => {
          actions.setYankMode(true);
          actions.setYankHelpOpen(false);
        },
        cancel: () => {
          actions.setYankMode(false);
          actions.setYankHelpOpen(false);
        },
        openHelp: () => {
          actions.setYankHelpOpen(true);
        },
        closeHelp: () => {
          actions.setYankHelpOpen(false);
        },
      },
      details: {
        close: closeDetails,
        closeHistogram: () => setHistogramState(null),
      },
      preview: {
        close: filePreview.closePreview,
        openFilter: filePreview.openFilter,
        closeFilter: filePreview.closeFilter,
        nextPage: filePreview.nextPage,
        prevPage: filePreview.prevPage,
        scrollUp: filePreview.previewNavigation.moveUp,
        scrollDown: filePreview.previewNavigation.moveDown,
        colLeft: filePreview.colScrollLeft,
        colRight: filePreview.colScrollRight,
        toTop: filePreview.previewNavigation.toTop,
        toBottom: filePreview.previewNavigation.toBottom,
        enterYank: filePreview.enterPreviewYank,
        cancelYank: filePreview.cancelPreviewYank,
        yankColumn: (colIndex: number) => {
          const ps = filePreview.previewState;
          if (!ps) return;
          const colsPerScreen = Math.max(1, Math.floor((termCols - 2) / (MIN_COL_WIDTH + GAP)));
          const visibleCols = ps.columns.slice(ps.colOffset, ps.colOffset + colsPerScreen);
          const col = visibleCols[colIndex];
          if (!col) return;
          const row = filePreview.getSelectedRow();
          const value = row?.cells[col.key]?.displayName?.trim() ?? "";
          if (!value) return;
          filePreview.cancelPreviewYank();
          void clipboardy.write(value).then(() => actions.pushFeedback(`Copied ${col.label}`, 1500));
        },
        showDetails: () => {
          const ps = filePreview.previewState;
          if (!ps) return;
          const row = filePreview.getSelectedRow();
          if (!row) return;
          const fields = ps.columns.map((col) => ({
            label: col.label,
            value: row.cells[col.key]?.displayName ?? "-",
          }));
          setPanelScrollOffset(0);
          actions.setDescribeState({ row, fields, loading: false, requestId: 0 });
        },
      },
      pending: {
        cancelPrompt: () => actions.setPendingAction(null),
        submit: (confirmed) => submitPendingAction(state.pendingAction, confirmed),
      },
      upload: {
        decide: handleUploadDecision,
      },
      adapterAction: {
        run: runAdapterAction,
        bindings: adapterBindings,
      },
    },
    yankOptions,
    pushYankFeedback: actions.pushFeedback,
    writeClipboard: clipboardy.write,
    hasCommandAutocomplete: (text) =>
      AVAILABLE_COMMANDS.some((cmd) => cmd.toLowerCase().startsWith(text.toLowerCase())),
  });

  useMainInput(inputDispatch);

  const activePickerFilter = pickers.activePicker?.filter ?? state.filterText;

  return (
    <FullscreenBox backgroundColor={theme.global.mainBg}>
      <Box flexDirection="column" width={termCols} height={termRows} backgroundColor={theme.global.mainBg}>
        <HUD
          serviceLabel={adapter.label}
          hudColor={theme.serviceColors[adapter.id] ?? adapter.hudColor}
          path={path}
          context={{ accountName, accountId, awsProfile, currentIdentity, region }}
          terminalWidth={termCols}
          loading={isLoading || Boolean(state.describeState?.loading)}
          watchInterval={watchInterval}
          tagFilter={tagFilter}
        />
        <Box flexDirection="row" width="100%" flexGrow={1} backgroundColor={theme.global.mainBg}>
          <AppMainView
            helpPanel={helpPanel}
            helpTabs={helpTabs}
            pickers={pickers}
            error={error}
            describeState={state.describeState}
            isLoading={isLoading}
            filteredRows={filteredRows}
            columns={columns}
            selectedIndex={navigation.selectedIndex}
            scrollOffset={navigation.scrollOffset}
            filterText={state.filterText}
            adapter={adapter}
            termCols={termCols}
            tableHeight={dataRows}
            contentBudget={contentBudget}
            yankHelpOpen={state.yankHelpOpen}
            yankOptions={yankOptions}
            yankHelpRow={selectedRow}
            uploadPending={state.uploadPending}
            uploadPreview={uploadPreview}
            panelScrollOffset={panelScrollOffset}
            footerContent={footerContent}
            selectedRowIds={selectedRowIds}
            bookmarkedIds={bookmarkedIds}
            searchHistory={searchHistory}
            searchHistoryIndex={searchHistoryIndex}
            showSearchHistory={showSearchHistory}
            histogramState={histogramState}
            filePreviewState={filePreview.previewState}
            filePreviewNavigation={filePreview.previewNavigation}
            filePreviewYankMode={filePreview.previewState?.previewYankMode ?? false}
            onPreviewFilterChange={filePreview.setFilterText}
            onPreviewFilterSubmit={filePreview.closeFilter}
            {...(yankHeaderMarkers ? { headerMarkers: yankHeaderMarkers } : {})}
            {...(sortState ? { sortState } : {})}
          />
        </Box>
        <Box paddingX={1} height={1}>
          {!helpPanel.helpOpen && yankFeedbackMessage ? (
            <Text color={theme.feedback.successText}>{yankFeedbackMessage}</Text>
          ) : (
            <Text> </Text>
          )}
        </Box>
        {state.pendingAction && state.pendingAction.effect.type === "prompt" && (
          <Box paddingX={1}>
            <Text color={theme.feedback.promptText}>{state.pendingAction.effect.label} </Text>
            <AdvancedTextInput
              value={state.pendingAction.inputValue}
              onChange={(value) => actions.setPendingInputValue(value)}
              onSubmit={() => submitPendingAction(state.pendingAction, true)}
              focus
            />
          </Box>
        )}
        {state.pendingAction && state.pendingAction.effect.type === "confirm" && (
          <Box paddingX={1}>
            <Text color={theme.feedback.confirmText}>{state.pendingAction.effect.message} (y/n)</Text>
          </Box>
        )}
        <ModeBar
          mode={state.mode}
          filterText={activePickerFilter}
          commandText={state.commandText}
          commandCursorToEndToken={state.commandCursorToEndToken}
          hintOverride={bottomHint}
          pickerSearchActive={pickers.activePicker?.pickerMode === "search"}
          onFilterChange={handleFilterChange}
          onCommandChange={actions.setCommandText}
          onFilterSubmit={handleFilterSubmit}
          onCommandSubmit={handleCommandSubmit}
        />
      </Box>
    </FullscreenBox>
  );
}
