import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { AVAILABLE_COMMANDS } from "./constants/commands.js";
import { buildHelpTabs, triggerToString } from "./constants/keybindings.js";
import type { InputRuntimeState } from "./hooks/inputEvents.js";
import {
  currentlySelectedServiceAtom,
  selectedRegionAtom,
  selectedProfileAtom,
} from "./state/atoms.js";

const INITIAL_AWS_PROFILE = process.env.AWS_PROFILE;

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

  const { accountName, accountId, awsProfile, currentIdentity, region } =
    useAwsContext(endpointUrl, selectedRegion, selectedProfile);
  const availableRegions = useAwsRegions(selectedRegion, selectedProfile);
  const availableProfiles = useAwsProfiles();

  const { reset: resetHierarchy, updateCurrentFilter, pushLevel, popLevel } = useHierarchyState();
  const { state, actions } = useAppController();

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
  });

  const [didOpenInitialResources, setDidOpenInitialResources] = useState(false);
  useEffect(() => {
    if (didOpenInitialResources) return;
    pickers.openPicker("resource");
    setDidOpenInitialResources(true);
  }, [didOpenInitialResources, pickers]);

  const switchAdapter = useCallback(
    (serviceId: ServiceId) => {
      setCurrentService(serviceId);
      actions.setFilterText("");
      actions.setDescribeState(null);
      actions.setSearchEntryFilter(null);
      actions.setMode("navigate");
      actions.setYankMode(false);
      actions.setUploadPending(null);
      actions.setPendingAction(null);
      resetHierarchy();
      navigation.reset();
    },
    [actions, navigation, resetHierarchy, setCurrentService],
  );

  const navigateBack = useCallback(() => {
    if (!adapter.canGoBack()) return;
    void goBack().then(() => {
      actions.setDescribeState(null);
      actions.setSearchEntryFilter(null);
      const { restoredFilter, restoredIndex } = popLevel();
      actions.setFilterText(restoredFilter);
      navigation.setIndex(restoredIndex);
    });
  }, [actions, adapter, goBack, navigation, popLevel]);

  const navigateIntoSelection = useCallback(() => {
    if (!selectedRow) return;
    if ((selectedRow.meta?.type as string) === "object") return;
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
        actions.setUploadPending({ filePath: result.filePath, metadata: result.metadata });
      }
    });
  }, [actions, navigation, pushLevel, select, selectedRow]);

  const editSelection = useCallback(() => {
    if (!selectedRow) return;
    void edit(selectedRow).then((result: ServiceViewResult) => {
      if (result.action === "edit" && "needsUpload" in result && result.needsUpload) {
        actions.setUploadPending({ filePath: result.filePath, metadata: result.metadata });
      }
    });
  }, [actions, edit, selectedRow]);

  const { showDetails, closeDetails } = useDetailController({
    adapter,
    setDescribeState: actions.setDescribeState,
  });

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
  const helpTabs = useMemo(
    () => buildHelpTabs(adapter.id, adapterBindings),
    [adapter.id, adapterBindings],
  );
  const helpContainerHeight = Math.max(1, termRows - HUD_LINES - MODEBAR_LINES);
  const helpPanel = useHelpPanel(helpTabs, helpContainerHeight);

  const nameOption = {
    trigger: { type: "key" as const, char: "n" },
    label: "copy name",
    feedback: "Copied Name",
    headerKey: "name",
    isRelevant: () => true,
    resolve: async (row: TableRow) => row.cells.name ?? null,
  };

  const yankOptions = useMemo(() => {
    const adapterOptions = selectedRow
      ? adapter.capabilities?.yank?.getYankOptions(selectedRow) ?? []
      : [];
    return [nameOption, ...adapterOptions];
  }, [adapter, selectedRow]);

  const yankHint = useMemo(
    () => [...yankOptions.map((o) => `${triggerToString(o.trigger)} · ${o.label}`), "Esc cancel"].join(" • "),
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
  });

  const commandRouter = useCommandRouter({
    setSelectedRegion,
    setSelectedProfile,
    switchAdapter,
    openProfilePicker: () => pickers.openPicker("profile"),
    openRegionPicker: () => pickers.openPicker("region"),
    openResourcePicker: () => pickers.openPicker("resource"),
    exit,
  });

  const handleFilterChange = useCallback(
    (value: string) => {
      if (pickers.activePicker) {
        pickers.activePicker.setFilter(value);
        return;
      }
      actions.setFilterText(value);
      updateCurrentFilter(value);
    },
    [actions, pickers, updateCurrentFilter],
  );

  const handleFilterSubmit = useCallback(() => {
    if (pickers.activePicker) {
      pickers.activePicker.confirmSearch();
      return;
    }
    actions.setSearchEntryFilter(null);
    actions.setMode("navigate");
  }, [actions, pickers]);

  const handleCommandSubmit = useCallback(() => {
    const command = state.commandText.trim();
    actions.setCommandText("");
    actions.setMode("navigate");
    commandRouter(command);
  }, [actions, commandRouter, state.commandText]);

  const handleUploadDecision = useCallback(
    (confirmed: boolean) => {
      if (!state.uploadPending) return;
      if (!confirmed) {
        actions.setUploadPending(null);
        return;
      }
      void (async () => {
        try {
          await adapter.capabilities?.edit?.uploadFile(
            state.uploadPending!.filePath,
            state.uploadPending!.metadata,
          );
        } catch (err) {
          actions.pushFeedback(`Upload failed: ${(err as Error).message}`, 3000);
        } finally {
          actions.setUploadPending(null);
        }
      })();
    },
    [actions, adapter.capabilities?.edit, state.uploadPending],
  );

  const commandAutocomplete = useCallback(() => {
    const match = AVAILABLE_COMMANDS.find((cmd) =>
      cmd.toLowerCase().startsWith(state.commandText.toLowerCase()),
    );
    if (!match) return;
    actions.setCommandText(match);
    actions.bumpCommandCursorToEnd();
  }, [actions, state.commandText]);

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
    }),
    [helpPanel.helpOpen, pickers.activePicker?.pickerMode, selectedRow, state],
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
        close: pickers.closeActivePicker,
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
          }),
      },
      mode: {
        cancelSearchOrCommand: () => {
          if (state.mode === "search") {
            if (state.searchEntryFilter !== null && state.filterText !== "") {
              handleFilterChange(state.searchEntryFilter);
            }
            actions.setSearchEntryFilter(null);
          }
          actions.setMode("navigate");
        },
        clearFilterOrNavigateBack: () => {
          if (state.filterText !== "") {
            handleFilterChange("");
          } else {
            navigateBack();
          }
        },
        startSearch: () => {
          actions.setSearchEntryFilter(state.filterText);
          actions.setMode("search");
        },
        startCommand: () => {
          actions.setCommandText("");
          actions.setMode("command");
        },
        commandAutocomplete,
      },
      navigation: {
        refresh: () => {
          void refresh();
        },
        showDetails: () => showDetails(selectedRow),
        editSelection,
        down: navigation.moveDown,
        up: navigation.moveUp,
        top: navigation.toTop,
        bottom: navigation.toBottom,
        enter: navigateIntoSelection,
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
          loading={isLoading || Boolean(state.describeState?.loading)}
        />
        <Box flexDirection="row" width="100%" flexGrow={1}>
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
            {...(yankHeaderMarkers ? { headerMarkers: yankHeaderMarkers } : {})}
          />
        </Box>
        {!helpPanel.helpOpen && state.yankFeedbackMessage && (
          <Box paddingX={1}>
            <Text color="green">{state.yankFeedbackMessage}</Text>
          </Box>
        )}
        {state.pendingAction && state.pendingAction.effect.type === "prompt" && (
          <Box paddingX={1}>
            <Text color="cyan">{state.pendingAction.effect.label} </Text>
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
            <Text color="yellow">{state.pendingAction.effect.message} (y/n)</Text>
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
