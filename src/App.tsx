import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useApp } from "ink";
import { useAtom } from "jotai";
import TextInput from "ink-text-input";

import { HUD } from "./components/HUD.js";
import { ModeBar } from "./components/ModeBar.js";
import { FullscreenBox, useScreenSize } from "./utils/withFullscreen.js";
import { useNavigation } from "./hooks/useNavigation.js";
import { useYankMode } from "./hooks/useYankMode.js";
import { useHelpPanel } from "./hooks/useHelpPanel.js";
import { usePendingAction } from "./hooks/usePendingAction.js";
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
import type { TableRow } from "./types.js";
import type { ServiceAdapter } from "./adapters/ServiceAdapter.js";
import type { ActionEffect } from "./adapters/capabilities/ActionCapability.js";
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
    fields: Array<{ label: string; value: string }> | null;
    loading: boolean;
    requestId: number;
  } | null>(null);
  const [searchEntryFilter, setSearchEntryFilter] = useState<string | null>(null);
  const [commandCursorToEndToken, setCommandCursorToEndToken] = useState(0);

  // Feature hooks
  const { yankMode, setYankMode, yankFeedback, setYankFeedback, pushYankFeedback } = useYankMode();
  const { pendingAction, setPendingAction } = usePendingAction();

  const adapter = useMemo<ServiceAdapter>(() => {
    return SERVICE_REGISTRY[currentService](endpointUrl, selectedRegion);
  }, [currentService, endpointUrl, selectedRegion]);

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
    const adapterOptions = adapter.capabilities?.yank?.getYankOptions(selectedRow) ?? [];
    return [...base, ...adapterOptions, { key: "Esc", label: "cancel", feedback: "" }];
  }, [adapter, selectedRow]);

  const yankHint = useMemo(
    () => yankOptions.map((item) => `${item.key} · ${item.label}`).join(" • "),
    [yankOptions],
  );

  // Help panel
  const adapterBindings = useMemo(
    () => adapter.capabilities?.actions?.getKeybindings() ?? [],
    [adapter],
  );
  const helpTabs = useMemo(
    () => buildHelpTabs(adapter.id, adapterBindings),
    [adapter.id, adapterBindings],
  );
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
          : pendingAction
            ? "adapter-action"
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
        return buildScopeHint("help", adapterBindings);
      case "regions":
      case "profiles":
      case "resources":
        return buildScopeHint("picker", adapterBindings);
      case "adapter-action":
        if (pendingAction?.effect.type === "prompt") {
          return " Enter value  •  Esc cancel";
        }
        if (pendingAction?.effect.type === "confirm") {
          return " y confirm  •  n/Esc cancel";
        }
        return "";
      case "upload":
        return buildScopeHint("upload", adapterBindings);
      case "details":
        return buildScopeHint("details", adapterBindings);
      case "yank":
        return ` ${yankHint}`;
      case "search":
        return buildScopeHint("search", adapterBindings);
      case "command":
        return COMMAND_MODE_HINT;
      default:
        return buildScopeHint("navigate", adapterBindings, 4);
    }
  }, [adapterBindings, uiScopeActual, yankHint, pendingAction]);

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
        const fields = adapter.capabilities?.detail
          ? await adapter.capabilities.detail.getDetails(selectedRow)
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

  const handleActionEffect = useCallback(
    (effect: ActionEffect, row: TableRow | null) => {
      switch (effect.type) {
        case "none":
          break;
        case "refresh":
          void refresh();
          break;
        case "feedback": {
          const timer = setTimeout(() => setYankFeedback(null), 2500);
          setYankFeedback({ message: effect.message, timer });
          setPendingAction(null);
          break;
        }
        case "clipboard": {
          const timer = setTimeout(() => setYankFeedback(null), 2500);
          setYankFeedback({ message: effect.feedback, timer });
          setPendingAction(null);
          break;
        }
        case "error": {
          const timer = setTimeout(() => setYankFeedback(null), 3000);
          setYankFeedback({ message: effect.message, timer });
          setPendingAction(null);
          break;
        }
        case "prompt":
          setPendingAction({
            effect,
            row,
            inputValue: effect.defaultValue ?? "",
            accumulatedData: effect.data ?? {},
          });
          break;
        case "confirm":
          setPendingAction({
            effect,
            row,
            inputValue: "",
            accumulatedData: effect.data ?? {},
          });
          break;
      }
    },
    [refresh, setYankFeedback],
  );

  const submitPendingAction = useCallback(
    (confirmed: boolean) => {
      if (!pendingAction || !adapter.capabilities?.actions) return;

      const effect = pendingAction.effect;
      if (effect.type === "confirm" && !confirmed) {
        setPendingAction(null);
        return;
      }

      const nextData = {
        ...pendingAction.accumulatedData,
        path: pendingAction.inputValue,
      };

      void adapter.capabilities.actions
        .executeAction(effect.nextActionId, {
          row: pendingAction.row,
          data: nextData,
        })
        .then((nextEffect) => {
          handleActionEffect(nextEffect, pendingAction.row);
        })
        .catch((err) => {
          const timer = setTimeout(() => setYankFeedback(null), 3000);
          setYankFeedback({
            message: `Action failed: ${(err as Error).message}`,
            timer,
          });
          setPendingAction(null);
        });
    },
    [
      adapter.capabilities?.actions,
      handleActionEffect,
      pendingAction,
      setYankFeedback,
    ],
  );

  // Wire up keyboard input (includes chord engine + ctrl-C handler)
  useMainInput(
    {
      mode,
      filterText,
      commandText,
      searchEntryFilter,
      yankMode,
      yankOptions,
      selectedRow,
      describeState,
      uploadPending,
      pendingAction,
      adapter,
      pickers,
      helpPanel,
    },
    {
      exit,
      setMode,
      moveDown,
      moveUp,
      toTop,
      toBottom,
      navigateIntoSelection,
      navigateBack,
      editSelection,
      showDetails,
      closeDetails,
      refresh,
      setCommandText,
      setCommandCursorToEndToken,
      setYankMode,
      pushYankFeedback,
      setYankFeedback,
      handleFilterChange,
      setSearchEntryFilter,
      setUploadPending,
      setSelectedRegion,
      setSelectedProfile,
      switchAdapter,
      handleActionEffect,
      submitPendingAction,
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
        {pendingAction && pendingAction.effect.type === "prompt" && (
          <Box paddingX={1}>
            <Text color="cyan">{pendingAction.effect.label} </Text>
            <TextInput
              value={pendingAction.inputValue}
              onChange={(value) =>
                setPendingAction((prev) =>
                  prev
                    ? {
                        ...prev,
                        inputValue: value,
                      }
                    : prev,
                )
              }
              onSubmit={() => submitPendingAction(true)}
              focus
            />
          </Box>
        )}
        {pendingAction && pendingAction.effect.type === "confirm" && (
          <Box paddingX={1}>
            <Text color="yellow">{pendingAction.effect.message} (y/n)</Text>
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
