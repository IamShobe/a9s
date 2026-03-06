import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useApp } from "ink";
import { useAtom } from "jotai";
import TextInput from "ink-text-input";

import { HUD } from "./components/HUD.js";
import { ModeBar } from "./components/ModeBar.js";
import { FullscreenBox, useScreenSize } from "./utils/withFullscreen.js";
import { useHelpPanel } from "./hooks/useHelpPanel.js";
import { useAwsContext } from "./hooks/useAwsContext.js";
import { useAwsRegions } from "./hooks/useAwsRegions.js";
import { useAwsProfiles } from "./hooks/useAwsProfiles.js";
import { useMainInput } from "./hooks/useMainInput.js";
import { useHierarchyState } from "./hooks/useHierarchyState.js";
import { useAppController } from "./hooks/useAppController.js";
import { useCommandRouter } from "./hooks/useCommandRouter.js";
import { useDetailController } from "./hooks/useDetailController.js";
import { useActionController } from "./hooks/useActionController.js";
import { useUiHints } from "./hooks/useUiHints.js";
import { useAppData } from "./hooks/useAppData.js";
import { AppMainView } from "./features/AppMainView.js";
import type { ServiceId } from "./services.js";
import type { ServiceViewResult, TableRow } from "./types.js";
import { AVAILABLE_COMMANDS } from "./constants/commands.js";
import { buildHelpTabs, triggerToString } from "./constants/keybindings.js";
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

  useMainInput(
    {
      mode: state.mode,
      filterText: state.filterText,
      commandText: state.commandText,
      searchEntryFilter: state.searchEntryFilter,
      yankMode: state.yankMode,
      yankOptions,
      selectedRow,
      describeState: state.describeState,
      uploadPending: state.uploadPending,
      pendingAction: state.pendingAction,
      adapter,
      pickers,
      helpPanel,
    },
    {
      exit,
      openHelp: helpPanel.open,
      closeHelp: helpPanel.close,
      helpPrevTab: helpPanel.goToPrevTab,
      helpNextTab: helpPanel.goToNextTab,
      helpScrollUp: helpPanel.scrollUp,
      helpScrollDown: helpPanel.scrollDown,
      helpGoToTab: (input) => {
        helpPanel.goToTab(input);
      },
      pickerClose: pickers.closeActivePicker,
      pickerCancelSearch: () => pickers.activePicker?.cancelSearch(),
      pickerStartSearch: () => pickers.activePicker?.startSearch(),
      pickerMoveDown: () => pickers.activePicker?.moveDown(),
      pickerMoveUp: () => pickers.activePicker?.moveUp(),
      pickerTop: () => pickers.activePicker?.toTop(),
      pickerBottom: () => pickers.activePicker?.toBottom(),
      pickerConfirm: () =>
        pickers.confirmActivePickerSelection({
          onSelectResource: switchAdapter,
          onSelectRegion: setSelectedRegion,
          onSelectProfile: setSelectedProfile,
        }),
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
      commandAutocomplete,
      startSearchMode: () => {
        actions.setSearchEntryFilter(state.filterText);
        actions.setMode("search");
      },
      startCommandMode: () => {
        actions.setCommandText("");
        actions.setMode("command");
      },
      navigateDown: navigation.moveDown,
      navigateUp: navigation.moveUp,
      navigateTop: navigation.toTop,
      navigateBottom: navigation.toBottom,
      navigateIntoSelection,
      editSelection,
      showDetails: () => showDetails(selectedRow),
      refresh: () => {
        void refresh();
      },
      enterYankMode: () => actions.setYankMode(true),
      cancelYankMode: () => actions.setYankMode(false),
      pushYankFeedback: actions.pushFeedback,
      runAdapterAction,
      closeDetails,
      cancelPendingPrompt: () => actions.setPendingAction(null),
      submitPendingAction: (confirmed) => submitPendingAction(state.pendingAction, confirmed),
      handleUploadDecision,
    },
  );

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
            <TextInput
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
