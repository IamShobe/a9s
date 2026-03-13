import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp } from "ink";
import { useAtom } from "jotai";
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
import { useHierarchyState } from "./hooks/useHierarchyState.js";
import { useAppController } from "./hooks/useAppController.js";
import { useCommandRouter } from "./hooks/useCommandRouter.js";
import { useDetailController } from "./hooks/useDetailController.js";
import { useActionController } from "./hooks/useActionController.js";
import { useUiHints } from "./hooks/useUiHints.js";
import { useAppData } from "./hooks/useAppData.js";
import { deriveYankHeaderMarkers } from "./hooks/yankHeaderMarkers.js";
import { AppMainView } from "./features/AppMainView.js";
import type { ServiceId } from "./services.js";
import type { ServiceViewResult, TableRow } from "./types.js";
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
import { summarizeRowStatuses } from "./utils/rowUtils.js";
import { loadSearchHistory, saveSearchEntry } from "./utils/searchHistory.js";
import { loadBookmarks, toggleBookmark } from "./utils/bookmarks.js";
import { buildHistogram } from "./utils/histogram.js";
import { isNumericColumn } from "./utils/heatmap.js";
import type { HistogramBar } from "./utils/histogram.js";
import {
  currentlySelectedServiceAtom,
  selectedRegionAtom,
  selectedProfileAtom,
  revealSecretsAtom,
  themeNameAtom,
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
  initialService: ServiceId;
  endpointUrl: string | undefined;
}

export function App({ initialService, endpointUrl }: AppProps) {
  const { exit } = useApp();
  const { columns: termCols, rows: termRows } = useScreenSize();

  const [selectedRegion, setSelectedRegion] = useAtom(selectedRegionAtom);
  const [selectedProfile, setSelectedProfile] = useAtom(selectedProfileAtom);
  const [currentService, setCurrentService] = useAtom(currentlySelectedServiceAtom);
  const [revealSecrets, setRevealSecrets] = useAtom(revealSecretsAtom);
  const [themeName, setThemeName] = useAtom(themeNameAtom);
  const theme = useTheme();

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

  const { reset: resetHierarchy, updateCurrentFilter, pushLevel, popLevel } = useHierarchyState();
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

  useEffect(() => {
    setCurrentService(initialService);
  }, [initialService, setCurrentService]);

  const HUD_LINES = 3;
  const MODEBAR_LINES = 1;
  const HEADER_LINES = 2;
  const tableHeight = Math.max(1, termRows - HUD_LINES - MODEBAR_LINES - HEADER_LINES - 4);

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
    return new Set(entries.filter((e) => e.serviceId === initialService).map((e) => e.rowId));
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
    selectedRow,
    navigation,
    pickers,
  } = useAppData({
    currentService,
    endpointUrl,
    selectedRegion,
    tableHeight,
    filterText: state.filterText,
    availableRegions,
    availableProfiles,
    relatedResources,
    tagFilter,
    sortState,
    heatmapEnabled,
    bookmarkedIds,
  });

  const isResourcesRootRef = useRef(true);

  const navigateToRoot = useCallback(() => {
    isResourcesRootRef.current = true;
    pickers.openPicker("resource");
  }, [pickers]);

  useEffect(() => {
    navigateToRoot();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const switchAdapter = useCallback(
    (serviceId: ServiceId) => {
      isResourcesRootRef.current = false;
      setCurrentService(serviceId);
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
      resetHierarchy();
      navigation.reset();
    },
    [actions, navigation, resetHierarchy, setCurrentService],
  );

  const navigateBack = useCallback(() => {
    if (!adapter.canGoBack()) {
      navigateToRoot();
      return;
    }
    void goBack().then(() => {
      actions.setDescribeState(null);
      actions.setSearchEntryFilter(null);
      const { restoredFilter, restoredIndex } = popLevel();
      actions.setFilterText(restoredFilter);
      navigation.setIndex(restoredIndex);
    });
  }, [actions, adapter, goBack, navigateToRoot, navigation, popLevel]);

  const navigateIntoSelection = useCallback(() => {
    if (!selectedRow) return;
    if (selectedRow.meta?.type === "object") return;
    void select(selectedRow).then((result: ServiceViewResult) => {
      if (result?.action === "navigate") {
        actions.setSearchEntryFilter(null);
        pushLevel(navigation.selectedIndex, "");
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
  }, [actions, navigation, pushLevel, select, selectedRow]);

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
    return { hasHiddenSecrets: hasSecretData && !revealSecrets };
  }, [filteredRows, revealSecrets]);

  const helpTabs = useMemo(
    () => buildHelpTabs(adapter.id, adapterBindings, uiHintsContext),
    [adapter.id, adapterBindings, uiHintsContext],
  );
  const helpContainerHeight = Math.max(1, termRows - HUD_LINES - MODEBAR_LINES);
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
    openProfilePicker: () => pickers.openPicker("profile"),
    openRegionPicker: () => pickers.openPicker("region"),
    openResourcePicker: () => pickers.openPicker("resource"),
    openThemePicker: () => pickers.openPicker("theme"),
    openBookmarksPicker: () => pickers.openPicker("bookmarks"),
    setWatch: setWatchInterval,
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
      updateCurrentFilter(value);
    },
    [actions, pickers, updateCurrentFilter, showSearchHistory],
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

  const statusSummary = useMemo(() => summarizeRowStatuses(filteredRows), [filteredRows]);

  const footerContent = useMemo(() => {
    if (statusSummary.byColor.length === 0) return null;
    const parts: React.ReactNode[] = [
      <Text key="total" color={theme.table.columnHeaderText}> Total: {statusSummary.total}</Text>,
    ];
    for (const { color, count, label } of statusSummary.byColor) {
      parts.push(
        <Text key={color} color={color}> ● {label}: {count}</Text>
      );
    }
    return <Box flexDirection="row">{parts}</Box>;
  }, [statusSummary, theme.table.columnHeaderText]);

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
      describeOpen: Boolean(state.describeState),
      uploadPending: Boolean(state.uploadPending),
      pendingActionType: state.pendingAction?.effect.type ?? null,
      histogramOpen: Boolean(histogramState),
    }),
    [helpPanel.helpOpen, pickers.activePicker?.pickerMode, selectedRow, state, histogramState],
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
          if (isResourcesRootRef.current && pickers.activePicker?.id === "resource") return;
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
            onSelectResource: switchAdapter,
            onSelectRegion: setSelectedRegion,
            onSelectProfile: setSelectedProfile,
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
              switchAdapter(entry.serviceId as ServiceId);
            },
          }),
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
          const nameCell = selectedRow.cells.name;
          const label = typeof nameCell === "object" ? (nameCell?.displayName ?? selectedRow.id) : (nameCell ?? selectedRow.id);
          const added = toggleBookmark({
            serviceId: currentService,
            rowId: selectedRow.id,
            rowLabel: label,
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
          const numericCol = columns.find((c) => isNumericColumn(filteredRows, c.key)) ?? columns[1];
          if (!numericCol) return;
          const values = filteredRows.map((r) => r.cells[numericCol.key]?.displayName ?? "");
          const bars = buildHistogram(values);
          setHistogramState({ columnKey: numericCol.key, columnLabel: numericCol.label, bars });
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
        showDetails: () => showDetails(selectedRow),
        editSelection,
        top: navigation.toTop,
        bottom: navigation.toBottom,
        enter: navigateIntoSelection,
        jumpToRelated: () => {
          if (!selectedRow) return;
          const resources = adapter.getRelatedResources?.(selectedRow) ?? [];
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
            tableHeight={tableHeight}
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
            {...(yankHeaderMarkers ? { headerMarkers: yankHeaderMarkers } : {})}
            {...(sortState ? { sortState } : {})}
          />
        </Box>
        {!helpPanel.helpOpen && yankFeedbackMessage && (
          <Box paddingX={1}>
            <Text color={theme.feedback.successText}>{yankFeedbackMessage}</Text>
          </Box>
        )}
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
