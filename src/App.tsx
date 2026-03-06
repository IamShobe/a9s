import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useApp } from "ink";
import { useAtom, getDefaultStore } from "jotai";
import TextInput from "ink-text-input";
import { isAbsolute, resolve } from "path";

import { HUD } from "./components/HUD.js";
import { ModeBar } from "./components/ModeBar.js";
import { FullscreenBox, useScreenSize } from "./utils/withFullscreen.js";
import { useNavigation } from "./hooks/useNavigation.js";
import { useYankMode } from "./hooks/useYankMode.js";
import { useHelpPanel } from "./hooks/useHelpPanel.js";
import { useFetchFlow } from "./hooks/useFetchFlow.js";
import { useServiceView } from "./hooks/useServiceView.js";
import { useAwsContext } from "./hooks/useAwsContext.js";
import { useAwsRegions } from "./hooks/useAwsRegions.js";
import { useAwsProfiles } from "./hooks/useAwsProfiles.js";
import { usePickerManager } from "./hooks/usePickerManager.js";
import { useMainInput } from "./hooks/useMainInput.js";
import { useHierarchyState } from "./hooks/useHierarchyState.js";
import { AppMainView } from "./features/AppMainView.js";
import { SERVICE_REGISTRY } from "./services.js";
import type { ServiceId } from "./services.js";
import { s3LevelAtom, s3BackStackAtom } from "./views/s3/adapter.js";
import type { TableRow } from "./types.js";
import type { DetailField, ServiceAdapter } from "./adapters/ServiceAdapter.js";
import { COMMAND_MODE_HINT } from "./constants/commands.js";
import { buildHelpTabs, buildScopeHint } from "./constants/keybindings.js";
import {
  currentlySelectedServiceAtom,
  modeAtom,
  filterTextAtom,
  commandTextAtom,
  selectedRegionAtom,
  selectedProfileAtom,
} from "./state/atoms.js";

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
  const {
    reset: resetHierarchy,
    updateCurrentFilter,
    pushLevel,
    popLevel,
  } = useHierarchyState();

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
  const [commandCursorToEndToken, setCommandCursorToEndToken] = useState(0);

  // Feature hooks
  const { yankMode, setYankMode, yankFeedback, setYankFeedback, pushYankFeedback } = useYankMode();
  const { fetchPrompt, setFetchPrompt, fetchOverwritePending, setFetchOverwritePending } = useFetchFlow();

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

  // Unified picker manager (replaces 3× usePickerState + 3× usePickerTable)
  const pickers = usePickerManager({ tableHeight, availableRegions, availableProfiles });
  const [didOpenInitialResources, setDidOpenInitialResources] = useState(false);

  useEffect(() => {
    if (didOpenInitialResources) return;
    pickers.resource.openPicker();
    pickers.resource.reset();
    setDidOpenInitialResources(true);
  }, [didOpenInitialResources, pickers.resource]);

  const selectedRow = filteredRows[selectedIndex] ?? null;

  const yankOptions = useMemo(() => {
    const base = [{ key: "n", label: "copy name", feedback: "Copied Name" }];
    if (!selectedRow) return [...base, { key: "Esc", label: "cancel", feedback: "" }];
    const adapterOptions = adapter.getYankOptions?.(selectedRow) ?? [];
    return [...base, ...adapterOptions, { key: "Esc", label: "cancel", feedback: "" }];
  }, [adapter, selectedRow]);

  const yankHint = useMemo(
    () => yankOptions.map((item) => `${item.key} · ${item.label}`).join(" • "),
    [yankOptions],
  );

  // Help panel
  const helpTabs = useMemo(() => buildHelpTabs(adapter.id), [adapter.id]);
  const helpContainerHeight = Math.max(1, termRows - HUD_LINES - MODEBAR_LINES);
  const helpPanel = useHelpPanel(helpTabs, helpContainerHeight);

  const uiScopeActual = helpPanel.helpOpen
    ? "help"
    : pickers.region.open
      ? "regions"
      : pickers.profile.open
        ? "profiles"
        : pickers.resource.open
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
        return buildScopeHint("help", adapter.id);
      case "regions":
      case "profiles":
      case "resources":
        return buildScopeHint("picker", adapter.id);
      case "jump":
        return " Enter jump  •  Esc cancel";
      case "fetch":
        return " Enter download to path  •  Esc cancel";
      case "fetch-overwrite":
        return " y overwrite file  •  n/Esc cancel";
      case "upload":
        return buildScopeHint("upload", adapter.id);
      case "details":
        return buildScopeHint("details", adapter.id);
      case "yank":
        return ` ${yankHint}`;
      case "search":
        return buildScopeHint("search", adapter.id);
      case "command":
        return COMMAND_MODE_HINT;
      default:
        return buildScopeHint("navigate", adapter.id, 4);
    }
  }, [adapter.id, uiScopeActual, yankHint]);

  const switchAdapter = useCallback(
    (serviceId: ServiceId) => {
      setCurrentService(serviceId);
      setFilterText("");
      setDescribeState(null);
      setSearchEntryFilter(null);
      resetHierarchy();
      reset();
    },
    [reset, resetHierarchy, setCurrentService, setFilterText],
  );

  const handleCommandSubmit = useCallback(() => {
    const command = commandText.trim();
    setCommandText("");
    setMode("navigate");
    if (command === "profiles") {
      pickers.profile.openPicker();
      pickers.profile.reset();
      return;
    }
    if (command === "regions") {
      pickers.region.openPicker();
      pickers.region.reset();
      return;
    }
    if (command === "resources") {
      pickers.resource.openPicker();
      pickers.resource.reset();
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
    commandText, exit, pickers, setCommandText, setMode,
    setSelectedProfile, setSelectedRegion, switchAdapter,
  ]);

  const handleFilterSubmit = useCallback(() => {
    if (pickers.region.open) { pickers.region.confirmSearch(); setMode("navigate"); return; }
    if (pickers.profile.open) { pickers.profile.confirmSearch(); setMode("navigate"); return; }
    if (pickers.resource.open) { pickers.resource.confirmSearch(); setMode("navigate"); return; }
    setSearchEntryFilter(null);
    setMode("navigate");
  }, [pickers, setMode]);

  const handleFilterChange = useCallback(
    (value: string) => {
      if (pickers.region.open) { pickers.region.setFilter(value); return; }
      if (pickers.profile.open) { pickers.profile.setFilter(value); return; }
      if (pickers.resource.open) { pickers.resource.setFilter(value); return; }
      setFilterText(value);
      updateCurrentFilter(value);
    },
    [pickers, setFilterText, updateCurrentFilter],
  );

  const navigateBack = useCallback(() => {
    if (!adapter.canGoBack()) return;
    void goBack().then(() => {
      setDescribeState(null);
      setSearchEntryFilter(null);
      const { restoredFilter, restoredIndex } = popLevel();
      setFilterText(restoredFilter);
      setIndex(restoredIndex);
    });
  }, [
    adapter,
    goBack,
    popLevel,
    setFilterText,
    setIndex,
  ]);

  const navigateIntoSelection = useCallback(() => {
    if (!selectedRow) return;
    if ((selectedRow.meta?.type as string) === "object") return;
    void select(selectedRow).then((result: any) => {
      if (result?.action === "navigate") {
        setSearchEntryFilter(null);
        pushLevel(selectedIndex, "");
        setFilterText("");
        setDescribeState(null);
        reset();
        return;
      }
      if (result?._needsUpload && result.metadata) {
        setUploadPending({ filePath: result.filePath, metadata: result.metadata });
      }
    });
  }, [pushLevel, reset, select, selectedRow, setFilterText, selectedIndex]);

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

  const closeDetails = useCallback(() => setDescribeState(null), []);

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
        pushLevel(selectedIndex, "");
        reset();
        await refresh();
      })
      .catch((err) => {
        const timer = setTimeout(() => setYankFeedback(null), 3000);
        setYankFeedback({ message: `Jump failed: ${(err as Error).message}`, timer });
      });
  }, [adapter, jumpPrompt, pushLevel, refresh, reset, setFilterText, setMode, setYankFeedback, selectedIndex]);

  // Wire up keyboard input (includes chord engine + ctrl-C handler)
  useMainInput(
    {
      mode, filterText, commandText, searchEntryFilter,
      yankMode, yankOptions, selectedRow,
      describeState, uploadPending, fetchPrompt, fetchOverwritePending, jumpPrompt,
      adapter, pickers, helpPanel,
    },
    {
      exit, setMode, moveDown, moveUp, toTop, toBottom,
      navigateIntoSelection, navigateBack, editSelection, showDetails, closeDetails,
      openFetchPrompt, refresh,
      setCommandText, setCommandCursorToEndToken,
      setYankMode, pushYankFeedback, setYankFeedback,
      handleFilterChange, setSearchEntryFilter, setJumpPrompt,
      setFetchPrompt, setFetchOverwritePending, setUploadPending,
      setSelectedRegion, setSelectedProfile, switchAdapter,
    },
  );

  const activePickerFilter = pickers.region.open
    ? pickers.region.filter
    : pickers.profile.open
      ? pickers.profile.filter
      : pickers.resource.open
        ? pickers.resource.filter
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
          loading={isLoading || Boolean(describeState?.loading)}
        />
        <Box flexDirection="row" width="100%" flexGrow={1}>
          <AppMainView
            helpPanel={helpPanel}
            helpTabs={helpTabs}
            pickers={pickers}
            error={error}
            describeState={describeState}
            isLoading={isLoading}
            filteredRows={filteredRows}
            columns={columns}
            selectedIndex={selectedIndex}
            scrollOffset={scrollOffset}
            filterText={filterText}
            adapter={adapter}
            termCols={termCols}
            tableHeight={tableHeight}
          />
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
