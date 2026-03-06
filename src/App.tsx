import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { atom, getDefaultStore, useAtom } from "jotai";
import clipboardy from "clipboardy";
import TextInput from "ink-text-input";
import { isAbsolute, resolve } from "path";

import { Table } from "./components/Table/index.js";
import { HUD } from "./components/HUD.js";
import { ModeBar } from "./components/ModeBar.js";
import { DetailPanel } from "./components/DetailPanel.js";
import { ErrorStatePanel } from "./components/ErrorStatePanel.js";
import { HelpPanel } from "./components/HelpPanel.js";
import { FullscreenBox, useScreenSize } from "./utils/withFullscreen.js";
import { useNavigation } from "./hooks/useNavigation.js";
import { usePickerTable } from "./hooks/usePickerTable.js";
import { usePickerState } from "./hooks/usePickerState.js";
import { useYankMode } from "./hooks/useYankMode.js";
import { useHelpPanel } from "./hooks/useHelpPanel.js";
import { useFetchFlow } from "./hooks/useFetchFlow.js";
import { useServiceView } from "./hooks/useServiceView.js";
import { useAwsContext } from "./hooks/useAwsContext.js";
import { useAwsRegions } from "./hooks/useAwsRegions.js";
import { useAwsProfiles } from "./hooks/useAwsProfiles.js";
import { SERVICE_REGISTRY } from "./services.js";
import type { ServiceId } from "./services.js";
import { s3LevelAtom, s3BackStackAtom } from "./views/s3/adapter.js";
import type { AppMode, TableRow } from "./types.js";
import type { DetailField, ServiceAdapter } from "./adapters/ServiceAdapter.js";
import { AVAILABLE_COMMANDS, COMMAND_MODE_HINT } from "./constants/commands.js";
import { buildHelpTabs } from "./constants/keybindings.js";

// Persistent atoms: survive HMR / re-renders, cross-feature state
const currentlySelectedServiceAtom = atom<ServiceId>("s3");
const modeAtom = atom<AppMode>("navigate");
const filterTextAtom = atom("");
const commandTextAtom = atom("");
const hierarchyStateAtom = atom<{ filters: string[]; indices: number[] }>({
  filters: [""],
  indices: [0],
});
const selectedRegionAtom = atom(
  process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1",
);
const selectedProfileAtom = atom(process.env.AWS_PROFILE ?? "$default");

let detailRequestSeq = 0;
const INITIAL_AWS_PROFILE = process.env.AWS_PROFILE;

function nextDetailRequestId(): number {
  detailRequestSeq += 1;
  return detailRequestSeq;
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
  const availableRegions = useAwsRegions(selectedRegion, selectedProfile);
  const availableProfiles = useAwsProfiles();
  const { accountName, accountId, awsProfile, currentIdentity, region } =
    useAwsContext(endpointUrl, selectedRegion, selectedProfile);

  const [currentService, setCurrentService] = useAtom(currentlySelectedServiceAtom);
  const [mode, setMode] = useAtom(modeAtom);
  const [filterText, setFilterText] = useAtom(filterTextAtom);
  const [commandText, setCommandText] = useAtom(commandTextAtom);
  const [hierarchyState, setHierarchyState] = useAtom(hierarchyStateAtom);

  // Local UI state
  const [uploadPending, setUploadPending] = useState<{
    filePath: string;
    metadata: Record<string, unknown>;
  } | null>(null);
  const [describeState, setDescribeState] = useState<{
    row: TableRow;
    fields: DetailField[] | null;
    loading: boolean;
    requestId: number;
  } | null>(null);
  const [searchEntryFilter, setSearchEntryFilter] = useState<string | null>(null);
  const [jumpPrompt, setJumpPrompt] = useState<string | null>(null);
  const [gPrefixPending, setGPrefixPending] = useState(false);
  const [commandCursorToEndToken, setCommandCursorToEndToken] = useState(0);

  // Feature hooks
  const { yankMode, setYankMode, yankFeedback, setYankFeedback, pushYankFeedback } = useYankMode();
  const { fetchPrompt, setFetchPrompt, fetchOverwritePending, setFetchOverwritePending } = useFetchFlow();
  const regionPicker = usePickerState();
  const profilePicker = usePickerState();
  const resourcePicker = usePickerState();

  const adapter = useMemo<ServiceAdapter>(() => {
    if (currentService === "s3") {
      const store = getDefaultStore();
      return SERVICE_REGISTRY.s3(
        endpointUrl,
        selectedRegion,
        () => store.get(s3LevelAtom),
        (level) => store.set(s3LevelAtom, level),
        () => store.get(s3BackStackAtom),
        (stack) => store.set(s3BackStackAtom, stack),
      );
    }
    return SERVICE_REGISTRY[currentService](endpointUrl, selectedRegion);
  }, [currentService, endpointUrl, selectedRegion, selectedProfile]);

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
  const tableHeight = Math.max(
    1,
    termRows - HUD_LINES - MODEBAR_LINES - HEADER_LINES - 4,
  );

  const { rows, columns, isLoading, error, select, edit, goBack, refresh, path } =
    useServiceView(adapter);

  const filteredRows = useMemo(() => {
    if (!filterText) return rows;
    const lowerFilter = filterText.toLowerCase();
    return rows.filter((row) =>
      Object.values(row.cells).some((value) =>
        value.toLowerCase().includes(lowerFilter),
      ),
    );
  }, [rows, filterText]);

  const { selectedIndex, scrollOffset, moveUp, moveDown, reset, setIndex, toTop, toBottom } =
    useNavigation(filteredRows.length, tableHeight);

  const currentFilterStack = hierarchyState.filters;
  const currentIndexStack = hierarchyState.indices;

  // Picker tables
  const regionRows = useMemo(
    () =>
      availableRegions.map((r) => ({
        id: r.name,
        cells: { region: r.name, description: r.description },
        meta: {},
      })),
    [availableRegions],
  );
  const {
    filteredRows: filteredRegionRows,
    selectedRow: selectedRegionRow,
    selectedIndex: regionSelectedIndex,
    scrollOffset: regionScrollOffset,
    moveUp: moveRegionUp,
    moveDown: moveRegionDown,
    reset: resetRegionNav,
    toTop: toRegionTop,
    toBottom: toRegionBottom,
  } = usePickerTable({ rows: regionRows, filterText: regionPicker.filter, maxHeight: tableHeight });

  const profileRows = useMemo(
    () =>
      availableProfiles.map((p) => ({
        id: p.name,
        cells: { profile: p.name, description: p.description },
        meta: {},
      })),
    [availableProfiles],
  );
  const {
    filteredRows: filteredProfileRows,
    selectedRow: selectedProfileRow,
    selectedIndex: profileSelectedIndex,
    scrollOffset: profileScrollOffset,
    moveUp: moveProfileUp,
    moveDown: moveProfileDown,
    reset: resetProfileNav,
    toTop: toProfileTop,
    toBottom: toProfileBottom,
  } = usePickerTable({ rows: profileRows, filterText: profilePicker.filter, maxHeight: tableHeight });

  const resourceRows = useMemo(
    () =>
      (Object.keys(SERVICE_REGISTRY) as ServiceId[]).map((serviceId) => ({
        id: serviceId,
        cells: { resource: serviceId, description: `${serviceId.toUpperCase()} service` },
        meta: {},
      })),
    [],
  );
  const {
    filteredRows: filteredResourceRows,
    selectedRow: selectedResourceRow,
    selectedIndex: resourceSelectedIndex,
    scrollOffset: resourceScrollOffset,
    moveUp: moveResourceUp,
    moveDown: moveResourceDown,
    reset: resetResourceNav,
    toTop: toResourceTop,
    toBottom: toResourceBottom,
  } = usePickerTable({ rows: resourceRows, filterText: resourcePicker.filter, maxHeight: tableHeight });

  const selectedRow = filteredRows[selectedIndex] ?? null;

  const yankOptions = useMemo(() => {
    const base = [{ key: "n", label: "copy name", feedback: "Copied Name" }];
    if (!selectedRow) return [...base, { key: "Esc", label: "cancel", feedback: "" }];
    const adapterOptions = adapter.getYankOptions?.(selectedRow) ?? [];
    return [...base, ...adapterOptions, { key: "Esc", label: "cancel", feedback: "" }];
  }, [adapter, selectedRow]);

  const yankHint = useMemo(
    () => yankOptions.map((item) => `${item.key} ${item.label}`).join("  •  "),
    [yankOptions],
  );

  // Help panel
  const helpTabs = useMemo(() => buildHelpTabs(adapter.id), [adapter.id]);
  const helpContainerHeight = Math.max(1, termRows - HUD_LINES - MODEBAR_LINES);
  const helpPanel = useHelpPanel(helpTabs, helpContainerHeight);

  const uiScopeActual = helpPanel.helpOpen
    ? "help"
    : regionPicker.open
      ? "regions"
      : profilePicker.open
        ? "profiles"
        : resourcePicker.open
          ? "resources"
        : jumpPrompt !== null
          ? "jump"
          : fetchOverwritePending
            ? "fetch-overwrite"
            : fetchPrompt
              ? "fetch"
              : uploadPending
                ? "upload"
                : describeState
                  ? "details"
                  : yankMode
                    ? "yank"
                    : mode;

  const bottomHint = useMemo(() => {
    switch (uiScopeActual) {
      case "help":
        return " ←/→ or h/l switch tabs  •  ↑/↓ or j/k scroll  •  Esc/? close";
      case "regions":
        return " j/k ↑↓ move  •  / filter  •  Enter select region  •  Esc close";
      case "profiles":
        return " j/k ↑↓ move  •  / filter  •  Enter select profile  •  Esc close";
      case "resources":
        return " j/k ↑↓ move  •  / filter  •  Enter select resource  •  Esc close";
      case "jump":
        return " Enter jump  •  Esc cancel";
      case "fetch":
        return " Enter download to path  •  Esc cancel";
      case "fetch-overwrite":
        return " y overwrite file  •  n/Esc cancel";
      case "upload":
        return " y upload edited file  •  n/Esc cancel";
      case "details":
        return " Esc close details";
      case "yank":
        return ` ${yankHint}`;
      case "search":
        return " Type filter  •  Tab autocomplete  •  Enter apply  •  Esc cancel";
      case "command":
        return COMMAND_MODE_HINT;
      default:
        return " j/k ↑/↓ move  •  gp go-path  •  gg/G top/bottom  •  Enter navigate  •  e edit  •  f fetch  •  / search";
    }
  }, [uiScopeActual, yankHint]);

  const switchAdapter = useCallback(
    (serviceId: ServiceId) => {
      setCurrentService(serviceId);
      setFilterText("");
      setDescribeState(null);
      setSearchEntryFilter(null);
      setHierarchyState({ filters: [""], indices: [0] });
      reset();
    },
    [reset, setCurrentService, setFilterText, setHierarchyState],
  );

  const handleCommandSubmit = useCallback(() => {
    const command = commandText.trim();
    setCommandText("");
    setMode("navigate");
    if (command === "profiles") {
      profilePicker.openPicker();
      resetProfileNav();
      return;
    }
    if (command === "regions") {
      regionPicker.openPicker();
      resetRegionNav();
      return;
    }
    if (command === "resources") {
      resourcePicker.openPicker();
      resetResourceNav();
      return;
    }
    const regionMatch = command.match(/^(region|use-region)\s+([a-z0-9-]+)$/i);
    if (regionMatch) {
      const nextRegion = regionMatch[2]?.toLowerCase();
      if (nextRegion) setSelectedRegion(nextRegion);
      return;
    }
    const profileMatch = command.match(/^(profile|use-profile)\s+(.+)$/i);
    if (profileMatch) {
      const nextProfile = profileMatch[2]?.trim();
      if (nextProfile) setSelectedProfile(nextProfile);
      return;
    }
    if (command === "quit" || command === "q") {
      exit();
      return;
    }
    if (command in SERVICE_REGISTRY) {
      switchAdapter(command as ServiceId);
    }
  }, [
    commandText,
    exit,
    profilePicker,
    regionPicker,
    resourcePicker,
    resetProfileNav,
    resetRegionNav,
    resetResourceNav,
    setCommandText,
    setMode,
    setSelectedProfile,
    setSelectedRegion,
    switchAdapter,
  ]);

  const handleFilterSubmit = useCallback(() => {
    if (regionPicker.open) { regionPicker.confirmSearch(); setMode("navigate"); return; }
    if (profilePicker.open) { profilePicker.confirmSearch(); setMode("navigate"); return; }
    if (resourcePicker.open) { resourcePicker.confirmSearch(); setMode("navigate"); return; }
    setSearchEntryFilter(null);
    setMode("navigate");
  }, [profilePicker, regionPicker, resourcePicker, setMode]);

  const handleFilterChange = useCallback(
    (value: string) => {
      if (regionPicker.open) { regionPicker.setFilter(value); return; }
      if (profilePicker.open) { profilePicker.setFilter(value); return; }
      if (resourcePicker.open) { resourcePicker.setFilter(value); return; }
      setFilterText(value);
      setHierarchyState((prev) => {
        const nextFilters =
          prev.filters.length === 0
            ? [value]
            : [...prev.filters.slice(0, -1), value];
        return { ...prev, filters: nextFilters };
      });
    },
    [profilePicker, regionPicker, resourcePicker, setHierarchyState, setFilterText],
  );

  const navigateBack = useCallback(() => {
    if (!adapter.canGoBack()) return;
    void goBack().then(() => {
      setDescribeState(null);
      setSearchEntryFilter(null);
      const nextStack =
        currentFilterStack.length > 1
          ? currentFilterStack.slice(0, -1)
          : currentFilterStack;
      const nextIndexStack =
        currentIndexStack.length > 1
          ? currentIndexStack.slice(0, -1)
          : currentIndexStack;
      setHierarchyState({ filters: nextStack, indices: nextIndexStack });
      const poppedIndex =
        currentIndexStack.length > 1
          ? (currentIndexStack[currentIndexStack.length - 1] ?? 0)
          : (currentIndexStack[0] ?? 0);
      const previousFilter = nextStack[nextStack.length - 1] ?? "";
      setFilterText(previousFilter);
      setIndex(poppedIndex);
    });
  }, [
    adapter, currentFilterStack, goBack, currentIndexStack,
    setFilterText, setHierarchyState, setIndex,
  ]);

  const navigateIntoSelection = useCallback(() => {
    if (!selectedRow) return;
    if ((selectedRow.meta?.type as string) === "object") return;
    void select(selectedRow).then((result: any) => {
      if (result?.action === "navigate") {
        setSearchEntryFilter(null);
        setHierarchyState((prev) => ({
          filters: [...prev.filters, ""],
          indices: [...prev.indices, selectedIndex],
        }));
        setFilterText("");
        setDescribeState(null);
        reset();
        return;
      }
      if (result?._needsUpload && result.metadata) {
        setUploadPending({ filePath: result.filePath, metadata: result.metadata });
      }
    });
  }, [reset, select, selectedRow, setFilterText, setHierarchyState, selectedIndex]);

  const editSelection = useCallback(() => {
    if (!selectedRow) return;
    void edit(selectedRow).then((result: any) => {
      if (result?._needsUpload && result.metadata) {
        setUploadPending({ filePath: result.filePath, metadata: result.metadata });
      }
    });
  }, [edit, selectedRow]);

  const showDetails = useCallback(() => {
    if (!selectedRow) return;
    const requestId = nextDetailRequestId();
    setDescribeState({ row: selectedRow, fields: null, loading: true, requestId });
    void (async () => {
      try {
        const fields = adapter.getDetails
          ? await adapter.getDetails(selectedRow)
          : [
              { label: "Name", value: selectedRow.cells.name ?? selectedRow.id },
              { label: "Type", value: String(selectedRow.meta?.type ?? "Unknown") },
              { label: "Details", value: "Not available for this service" },
            ];
        setDescribeState((prev) =>
          prev && prev.requestId === requestId
            ? { ...prev, fields, loading: false, requestId }
            : prev,
        );
      } catch (error) {
        setDescribeState((prev) =>
          prev && prev.requestId === requestId
            ? {
                ...prev,
                fields: [
                  { label: "Name", value: selectedRow.cells.name ?? selectedRow.id },
                  { label: "Error", value: (error as Error).message },
                ],
                loading: false,
                requestId,
              }
            : prev,
        );
      }
    })();
  }, [adapter, selectedRow]);

  const openFetchPrompt = useCallback(() => {
    if (!selectedRow || (selectedRow.meta?.type as string) !== "object") return;
    const configured = process.env.DOWNLOAD_LOCATION;
    const cwd = process.cwd();
    const defaultPath = configured
      ? isAbsolute(configured) ? configured : resolve(cwd, configured)
      : cwd;
    setFetchPrompt({ row: selectedRow, destinationPath: defaultPath });
  }, [selectedRow, setFetchPrompt]);

  const submitFetchPrompt = useCallback(() => {
    if (!fetchPrompt) return;
    const target = fetchPrompt.destinationPath.trim();
    if (!target) return;
    if (!adapter.fetchTo) return;
    void adapter
      .fetchTo(fetchPrompt.row, target, false)
      .then((savedTo) => {
        const timer = setTimeout(() => setYankFeedback(null), 2500);
        setYankFeedback({ message: `Downloaded to ${savedTo}`, timer });
      })
      .catch((err) => {
        const message = (err as Error).message;
        if (message.startsWith("EEXIST_FILE:")) {
          const finalPath = message.slice("EEXIST_FILE:".length);
          setFetchOverwritePending({ row: fetchPrompt.row, destinationPath: target, finalPath });
          setFetchPrompt(null);
          return;
        }
        const timer = setTimeout(() => setYankFeedback(null), 3000);
        setYankFeedback({ message: `Fetch failed: ${message}`, timer });
      })
      .finally(() => {
        setFetchPrompt((prev) => prev && prev.row.id === fetchPrompt.row.id ? null : prev);
      });
  }, [adapter, fetchPrompt, setFetchOverwritePending, setFetchPrompt, setYankFeedback]);

  const submitJumpPrompt = useCallback(() => {
    if (jumpPrompt === null) return;
    const target = jumpPrompt.trim();
    if (!target) return;
    if (!adapter.jumpTo) return;
    void adapter
      .jumpTo(target)
      .then(async () => {
        setJumpPrompt(null);
        setMode("navigate");
        setFilterText("");
        setSearchEntryFilter(null);
        setHierarchyState((prev) => ({
          filters: [...prev.filters, ""],
          indices: [...prev.indices, selectedIndex],
        }));
        reset();
        await refresh();
      })
      .catch((err) => {
        const timer = setTimeout(() => setYankFeedback(null), 3000);
        setYankFeedback({ message: `Jump failed: ${(err as Error).message}`, timer });
      });
  }, [adapter, jumpPrompt, refresh, reset, setFilterText, setHierarchyState, setMode, setYankFeedback, selectedIndex]);

  useInput(
    (input, key) => {
      if (helpPanel.helpOpen) {
        if (gPrefixPending) setGPrefixPending(false);
        if (key.escape || input === "?") { helpPanel.close(); return; }
        if (key.leftArrow || input === "h") { helpPanel.goToPrevTab(); return; }
        if (key.rightArrow || input === "l") { helpPanel.goToNextTab(); return; }
        if (key.upArrow || input === "k") { helpPanel.scrollUp(); return; }
        if (key.downArrow || input === "j") { helpPanel.scrollDown(); return; }
        helpPanel.goToTab(input);
        return;
      }

      if (resourcePicker.open) {
        if (input === "G") { setGPrefixPending(false); toResourceBottom(); return; }
        if (input === "g") {
          if (gPrefixPending) { setGPrefixPending(false); toResourceTop(); }
          else { setGPrefixPending(true); }
          return;
        }
        if (gPrefixPending) setGPrefixPending(false);
        if (key.escape) {
          if (mode === "search") { resourcePicker.cancelSearch(); setMode("navigate"); }
          else { resourcePicker.closePicker(); setMode("navigate"); }
          return;
        }
        if (mode === "search") return;
        if (input === "/") { resourcePicker.startSearch(); setMode("search"); return; }
        if (key.downArrow || input === "j") { moveResourceDown(); return; }
        if (key.upArrow || input === "k") { moveResourceUp(); return; }
        if (key.return && selectedResourceRow) {
          switchAdapter(selectedResourceRow.id as ServiceId);
          resourcePicker.closePicker();
          setMode("navigate");
        }
        return;
      }

      if (input === "?") {
        if (gPrefixPending) setGPrefixPending(false);
        if (mode === "navigate" && !uploadPending && !describeState && !yankMode) {
          helpPanel.open();
        }
        return;
      }

      if (jumpPrompt !== null) {
        if (key.escape) setJumpPrompt(null);
        return;
      }

      if (fetchOverwritePending) {
        if (input === "y" || input === "Y") {
          if (!adapter.fetchTo) { setFetchOverwritePending(null); return; }
          void adapter
            .fetchTo(fetchOverwritePending.row, fetchOverwritePending.destinationPath, true)
            .then((savedTo) => {
              const timer = setTimeout(() => setYankFeedback(null), 2500);
              setYankFeedback({ message: `Downloaded to ${savedTo}`, timer });
            })
            .catch((err) => {
              const timer = setTimeout(() => setYankFeedback(null), 3000);
              setYankFeedback({ message: `Fetch failed: ${(err as Error).message}`, timer });
            })
            .finally(() => { setFetchOverwritePending(null); });
        } else if (input === "n" || input === "N" || key.escape) {
          setFetchOverwritePending(null);
        }
        return;
      }

      if (fetchPrompt) {
        if (key.escape) setFetchPrompt(null);
        return;
      }

      if (regionPicker.open) {
        if (input === "G") { setGPrefixPending(false); toRegionBottom(); return; }
        if (input === "g") {
          if (gPrefixPending) { setGPrefixPending(false); toRegionTop(); }
          else { setGPrefixPending(true); }
          return;
        }
        if (gPrefixPending) setGPrefixPending(false);
        if (key.escape) {
          if (mode === "search") { regionPicker.cancelSearch(); setMode("navigate"); }
          else { regionPicker.closePicker(); setMode("navigate"); }
          return;
        }
        if (mode === "search") return;
        if (input === "/") { regionPicker.startSearch(); setMode("search"); return; }
        if (key.downArrow || input === "j") { moveRegionDown(); return; }
        if (key.upArrow || input === "k") { moveRegionUp(); return; }
        if (key.return && selectedRegionRow) {
          setSelectedRegion(selectedRegionRow.id);
          regionPicker.closePicker();
          setMode("navigate");
        }
        return;
      }

      if (profilePicker.open) {
        if (input === "G") { setGPrefixPending(false); toProfileBottom(); return; }
        if (input === "g") {
          if (gPrefixPending) { setGPrefixPending(false); toProfileTop(); }
          else { setGPrefixPending(true); }
          return;
        }
        if (gPrefixPending) setGPrefixPending(false);
        if (key.escape) {
          if (mode === "search") { profilePicker.cancelSearch(); setMode("navigate"); }
          else { profilePicker.closePicker(); setMode("navigate"); }
          return;
        }
        if (mode === "search") return;
        if (input === "/") { profilePicker.startSearch(); setMode("search"); return; }
        if (key.downArrow || input === "j") { moveProfileDown(); return; }
        if (key.upArrow || input === "k") { moveProfileUp(); return; }
        if (key.return && selectedProfileRow) {
          setSelectedProfile(selectedProfileRow.id);
          profilePicker.closePicker();
          setMode("navigate");
        }
        return;
      }

      if (uploadPending) {
        if (gPrefixPending) setGPrefixPending(false);
        if (input === "y" || input === "Y") {
          void (async () => {
            try {
              await adapter.uploadFile?.(uploadPending.filePath, uploadPending.metadata);
            } catch (err) {
              console.error("Upload failed:", (err as Error).message);
            } finally {
              setUploadPending(null);
            }
          })();
        } else if (input === "n" || input === "N" || key.escape) {
          setUploadPending(null);
        }
        return;
      }

      if (describeState) {
        if (gPrefixPending) setGPrefixPending(false);
        if (key.escape) setDescribeState(null);
        return;
      }

      if (yankMode) {
        if (gPrefixPending) setGPrefixPending(false);
        if (!selectedRow) return;

        if (key.escape) {
          setYankMode(false);
        } else if (input === "n") {
          setYankMode(false);
          void clipboardy.write(selectedRow.cells.name ?? "").then(() => pushYankFeedback("Copied Name"));
        } else {
          const option = yankOptions.find((o) => o.key === input && o.key !== "Esc");
          if (option && adapter.getClipboardValue) {
            setYankMode(false);
            void adapter.getClipboardValue(selectedRow, input).then((value) => {
              if (value) void clipboardy.write(value).then(() => pushYankFeedback(option.feedback));
            });
          }
        }
        return;
      }

      if (key.escape) {
        if (gPrefixPending) setGPrefixPending(false);
        if (mode === "search" || mode === "command") {
          if (mode === "search" && searchEntryFilter !== null && filterText !== "") {
            handleFilterChange(searchEntryFilter);
          }
          if (mode === "search") setSearchEntryFilter(null);
          setMode("navigate");
        } else {
          if (filterText !== "") { handleFilterChange(""); }
          else { navigateBack(); }
        }
        return;
      }

      if (key.tab) {
        if (gPrefixPending) setGPrefixPending(false);
        if (mode === "command" && commandText) {
          const match = AVAILABLE_COMMANDS.find((cmd) =>
            cmd.toLowerCase().startsWith(commandText.toLowerCase()),
          );
          if (match) { setCommandText(match); setCommandCursorToEndToken((t) => t + 1); }
        }
        return;
      }

      if (mode === "search" || mode === "command") return;

      if (input === "/") {
        if (gPrefixPending) setGPrefixPending(false);
        setSearchEntryFilter(filterText);
        setMode("search");
        return;
      }

      if (input === ":") {
        if (gPrefixPending) setGPrefixPending(false);
        setCommandText("");
        setMode("command");
        return;
      }

      if (input === "q") { if (gPrefixPending) setGPrefixPending(false); exit(); return; }
      if (input === "r") { if (gPrefixPending) setGPrefixPending(false); void refresh(); return; }
      if (input === "y") { if (gPrefixPending) setGPrefixPending(false); setYankMode(true); return; }
      if (input === "d") { if (gPrefixPending) setGPrefixPending(false); showDetails(); return; }
      if (input === "e") { if (gPrefixPending) setGPrefixPending(false); editSelection(); return; }
      if (input === "f") { if (gPrefixPending) setGPrefixPending(false); openFetchPrompt(); return; }

      if (input === "G") { setGPrefixPending(false); toBottom(); return; }

      if (input === "p" && gPrefixPending) {
        setGPrefixPending(false);
        if (adapter.id === "s3") setJumpPrompt("/");
        return;
      }

      if (input === "g") {
        if (gPrefixPending) { setGPrefixPending(false); toTop(); }
        else { setGPrefixPending(true); }
        return;
      }

      if (gPrefixPending) setGPrefixPending(false);

      if (key.downArrow || input === "j") { moveDown(); return; }
      if (key.upArrow || input === "k") { moveUp(); return; }
      if (key.return) { navigateIntoSelection(); }
    },
    { isActive: true },
  );

  useEffect(() => {
    const handle = (data: Buffer) => {
      if (data.toString() === "\x03") exit();
    };
    process.stdin.on("data", handle);
    return () => { process.stdin.off("data", handle); };
  }, [exit]);

  const activePickerFilter = regionPicker.open
    ? regionPicker.filter
    : profilePicker.open
      ? profilePicker.filter
      : resourcePicker.open
        ? resourcePicker.filter
        : filterText;

  return (
    <FullscreenBox>
      <Box flexDirection="column" width={termCols} height={termRows}>
        <HUD
          serviceLabel={adapter.label}
          hudColor={adapter.hudColor}
          path={path}
          accountName={accountName}
          accountId={accountId}
          awsProfile={awsProfile}
          currentIdentity={currentIdentity}
          region={region}
          terminalWidth={termCols}
        />
        <Box flexDirection="row" width="100%" flexGrow={1}>
          {helpPanel.helpOpen ? (
            <Box width="100%" borderStyle="round" borderColor="blue">
              <HelpPanel
                title="Keyboard Help"
                scopeLabel="All modes reference"
                tabs={helpTabs}
                activeTab={helpPanel.helpTabIndex}
                terminalWidth={termCols}
                maxRows={helpPanel.helpVisibleRows}
                scrollOffset={helpPanel.helpScrollOffset}
              />
            </Box>
          ) : regionPicker.open ? (
            <Table
              rows={filteredRegionRows}
              columns={[
                { key: "region", label: "Region" },
                { key: "description", label: "Description" },
              ]}
              selectedIndex={regionSelectedIndex}
              filterText={regionPicker.filter}
              terminalWidth={termCols}
              maxHeight={tableHeight}
              scrollOffset={regionScrollOffset}
              contextLabel="Select AWS Region"
            />
          ) : profilePicker.open ? (
            <Table
              rows={filteredProfileRows}
              columns={[
                { key: "profile", label: "Profile" },
                { key: "description", label: "Description" },
              ]}
              selectedIndex={profileSelectedIndex}
              filterText={profilePicker.filter}
              terminalWidth={termCols}
              maxHeight={tableHeight}
              scrollOffset={profileScrollOffset}
              contextLabel="Select AWS Profile"
            />
          ) : resourcePicker.open ? (
            <Table
              rows={filteredResourceRows}
              columns={[
                { key: "resource", label: "Resource" },
                { key: "description", label: "Description" },
              ]}
              selectedIndex={resourceSelectedIndex}
              filterText={resourcePicker.filter}
              terminalWidth={termCols}
              maxHeight={tableHeight}
              scrollOffset={resourceScrollOffset}
              contextLabel="Select AWS Resource"
            />
          ) : error ? (
            <ErrorStatePanel
              title={`Failed to load ${adapter.label}`}
              message={error}
              hint="Press r to retry"
            />
          ) : describeState ? (
            <Box width="100%" borderStyle="round" borderColor="gray">
              <DetailPanel
                title={describeState.row.cells.name ?? describeState.row.id}
                fields={describeState.fields ?? []}
                isLoading={describeState.loading}
              />
            </Box>
          ) : isLoading && filteredRows.length === 0 ? (
            <Box width="100%" borderStyle="round" borderColor="blue">
              <Box flexDirection="column" paddingX={1}>
                <Text bold color="blue">Loading {adapter.label}...</Text>
              </Box>
            </Box>
          ) : (
            <Table
              rows={filteredRows}
              columns={columns}
              selectedIndex={selectedIndex}
              filterText={filterText}
              terminalWidth={termCols}
              maxHeight={tableHeight}
              scrollOffset={scrollOffset}
              contextLabel={adapter.getContextLabel?.() ?? ""}
            />
          )}
        </Box>
        {!helpPanel.helpOpen && yankFeedback && (
          <Box paddingX={1}>
            <Text color="green">{yankFeedback.message}</Text>
          </Box>
        )}
        {fetchPrompt && (
          <Box paddingX={1}>
            <Text color="cyan">Fetch to: </Text>
            <TextInput
              value={fetchPrompt.destinationPath}
              onChange={(value) =>
                setFetchPrompt((prev) => prev ? { ...prev, destinationPath: value } : prev)
              }
              onSubmit={submitFetchPrompt}
              focus
            />
          </Box>
        )}
        {jumpPrompt !== null && (
          <Box paddingX={1}>
            <Text color="cyan">Jump to: </Text>
            <TextInput
              value={jumpPrompt}
              onChange={setJumpPrompt}
              onSubmit={submitJumpPrompt}
              focus
            />
          </Box>
        )}
        {fetchOverwritePending && (
          <Box paddingX={1}>
            <Text color="yellow">
              Overwrite existing file {fetchOverwritePending.finalPath}? (y/n)
            </Text>
          </Box>
        )}
        <ModeBar
          mode={mode}
          filterText={activePickerFilter}
          commandText={commandText}
          commandCursorToEndToken={commandCursorToEndToken}
          hintOverride={bottomHint}
          onFilterChange={handleFilterChange}
          onCommandChange={setCommandText}
          onFilterSubmit={handleFilterSubmit}
          onCommandSubmit={handleCommandSubmit}
        />
      </Box>
    </FullscreenBox>
  );
}
