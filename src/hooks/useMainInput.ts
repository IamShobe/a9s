import { useEffect, useCallback } from "react";
import { useInput } from "ink";
import type { Key } from "ink";
import clipboardy from "clipboardy";
import type { AppMode, TableRow } from "../types.js";
import type { ServiceAdapter, YankOption } from "../adapters/ServiceAdapter.js";
import type { PendingAction } from "./usePendingAction.js";
import type { PickerManager } from "./usePickerManager.js";
import type { HelpPanelState } from "./useHelpPanel.js";
import { AVAILABLE_COMMANDS } from "../constants/commands.js";
import { useKeyChord, matchesTrigger } from "./useKeyChord.js";
import { KEYBINDINGS } from "../constants/keybindings.js";
import { resolveHelpScopeAction, resolveNavigateScopeAction, resolvePickerScopeAction } from "./mainInputScopes.js";

export interface MainInputState {
  mode: AppMode;
  filterText: string;
  commandText: string;
  searchEntryFilter: string | null;
  yankMode: boolean;
  yankOptions: YankOption[];
  selectedRow: TableRow | null;
  describeState: unknown | null;
  uploadPending: { filePath: string; metadata: Record<string, unknown> } | null;
  pendingAction: PendingAction | null;
  adapter: ServiceAdapter;
  pickers: PickerManager;
  helpPanel: HelpPanelState;
}

export interface MainInputHandlers {
  exit: () => void;
  openHelp: () => void;
  closeHelp: () => void;
  helpPrevTab: () => void;
  helpNextTab: () => void;
  helpScrollUp: () => void;
  helpScrollDown: () => void;
  helpGoToTab: (input: string) => void;

  pickerClose: () => void;
  pickerCancelSearch: () => void;
  pickerStartSearch: () => void;
  pickerMoveDown: () => void;
  pickerMoveUp: () => void;
  pickerTop: () => void;
  pickerBottom: () => void;
  pickerConfirm: () => void;

  cancelSearchOrCommand: () => void;
  clearFilterOrNavigateBack: () => void;
  commandAutocomplete: () => void;

  startSearchMode: () => void;
  startCommandMode: () => void;
  navigateDown: () => void;
  navigateUp: () => void;
  navigateTop: () => void;
  navigateBottom: () => void;
  navigateIntoSelection: () => void;
  editSelection: () => void;
  showDetails: () => void;
  refresh: () => void;

  enterYankMode: () => void;
  cancelYankMode: () => void;
  pushYankFeedback: (message: string, durationMs?: number) => void;
  runAdapterAction: (actionId: string, row: TableRow | null) => void;

  closeDetails: () => void;

  cancelPendingPrompt: () => void;
  submitPendingAction: (confirmed: boolean) => void;

  handleUploadDecision: (confirmed: boolean) => void;
}

export function useMainInput(state: MainInputState, handlers: MainInputHandlers) {
  const {
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
  } = state;

  const {
    exit,
    openHelp,
    closeHelp,
    helpPrevTab,
    helpNextTab,
    helpScrollUp,
    helpScrollDown,
    helpGoToTab,
    pickerClose,
    pickerCancelSearch,
    pickerStartSearch,
    pickerMoveDown,
    pickerMoveUp,
    pickerTop,
    pickerBottom,
    pickerConfirm,
    cancelSearchOrCommand,
    clearFilterOrNavigateBack,
    commandAutocomplete,
    startSearchMode,
    startCommandMode,
    navigateDown,
    navigateUp,
    navigateTop,
    navigateBottom,
    navigateIntoSelection,
    editSelection,
    showDetails,
    refresh,
    enterYankMode,
    cancelYankMode,
    pushYankFeedback,
    runAdapterAction,
    closeDetails,
    cancelPendingPrompt,
    submitPendingAction,
    handleUploadDecision,
  } = handlers;

  const { resolve, reset: resetChord } = useKeyChord(KEYBINDINGS);

  // Ctrl-C fallback
  useEffect(() => {
    const handle = (data: Buffer) => {
      if (data.toString() === "\x03") exit();
    };
    process.stdin.on("data", handle);
    return () => {
      process.stdin.off("data", handle);
    };
  }, [exit]);

  const handleInput = useCallback(
    (input: string, key: Key) => {
      if (helpPanel.helpOpen) {
        const action = resolveHelpScopeAction(input, resolve(input, key, "help"));
        switch (action.type) {
          case "close":
            resetChord();
            closeHelp();
            return;
          case "prevTab":
            resetChord();
            helpPrevTab();
            return;
          case "nextTab":
            resetChord();
            helpNextTab();
            return;
          case "scrollUp":
            resetChord();
            helpScrollUp();
            return;
          case "scrollDown":
            resetChord();
            helpScrollDown();
            return;
          case "goToTab":
            resetChord();
            helpGoToTab(action.input);
            return;
          case "none":
            return;
        }
      }

      if (pickers.activePicker) {
        const action = resolvePickerScopeAction(
          key,
          pickers.activePicker.pickerMode,
          resolve(input, key, "picker"),
        );

        switch (action.type) {
          case "consume":
            return;
          case "close":
            resetChord();
            if (pickers.activePicker.pickerMode === "search") {
              pickerCancelSearch();
            } else {
              pickerClose();
            }
            return;
          case "search":
            resetChord();
            if (pickers.activePicker.pickerMode !== "search") {
              pickerStartSearch();
            }
            return;
          case "down":
            resetChord();
            pickerMoveDown();
            return;
          case "up":
            resetChord();
            pickerMoveUp();
            return;
          case "top":
            resetChord();
            pickerTop();
            return;
          case "bottom":
            resetChord();
            pickerBottom();
            return;
          case "confirm":
            resetChord();
            pickerConfirm();
            return;
          case "none":
            return;
        }
      }

      if (input === "?") {
        resetChord();
        if (mode === "navigate" && !uploadPending && !describeState && !yankMode && !pendingAction) {
          openHelp();
        }
        return;
      }

      if (pendingAction) {
        resetChord();
        if (pendingAction.effect.type === "prompt") {
          if (key.escape) {
            cancelPendingPrompt();
          }
          return;
        }
        if (pendingAction.effect.type === "confirm") {
          if (input === "y" || input === "Y") {
            submitPendingAction(true);
          } else if (input === "n" || input === "N" || key.escape) {
            submitPendingAction(false);
          }
          return;
        }
        return;
      }

      if (uploadPending) {
        resetChord();
        if (input === "y" || input === "Y") {
          handleUploadDecision(true);
        } else if (input === "n" || input === "N" || key.escape) {
          handleUploadDecision(false);
        }
        return;
      }

      if (describeState) {
        resetChord();
        if (key.escape) closeDetails();
        return;
      }

      if (yankMode) {
        resetChord();
        if (!selectedRow) return;
        if (key.escape) {
          cancelYankMode();
          return;
        }

        const option = yankOptions.find((o) => matchesTrigger(input, key, o.trigger));
        if (!option) return;

        cancelYankMode();
        void option.resolve(selectedRow).then((value) => {
          if (!value) return;
          void clipboardy.write(value).then(() => pushYankFeedback(option.feedback));
        });
        return;
      }

      if (key.escape) {
        resetChord();
        if (mode === "search" || mode === "command") {
          cancelSearchOrCommand();
        } else {
          clearFilterOrNavigateBack();
        }
        return;
      }

      if (key.tab) {
        resetChord();
        if (mode === "command" && commandText) {
          const match = AVAILABLE_COMMANDS.find((cmd) =>
            cmd.toLowerCase().startsWith(commandText.toLowerCase()),
          );
          if (match) {
            commandAutocomplete();
          }
        }
        return;
      }

      if (mode === "search" || mode === "command") return;

      const action = resolveNavigateScopeAction(resolve(input, key, "navigate"));
      switch (action.type) {
        case "search":
          startSearchMode();
          return;
        case "command":
          startCommandMode();
          return;
        case "quit":
          exit();
          return;
        case "refresh":
          refresh();
          return;
        case "yank":
          enterYankMode();
          return;
        case "details":
          showDetails();
          return;
        case "edit":
          editSelection();
          return;
        case "bottom":
          navigateBottom();
          return;
        case "top":
          navigateTop();
          return;
        case "down":
          navigateDown();
          return;
        case "up":
          navigateUp();
          return;
        case "enter":
          navigateIntoSelection();
          return;
        case "none":
          if (adapter.capabilities?.actions) {
            const adapterBindings = adapter.capabilities.actions.getKeybindings();
            for (const binding of adapterBindings) {
              if (binding.trigger.type === "key" && binding.trigger.char === input) {
                runAdapterAction(binding.actionId, selectedRow);
                resetChord();
                return;
              }
            }
          }
      }
    },
    [
      adapter,
      cancelPendingPrompt,
      cancelSearchOrCommand,
      cancelYankMode,
      clearFilterOrNavigateBack,
      closeDetails,
      closeHelp,
      commandAutocomplete,
      commandText,
      describeState,
      editSelection,
      enterYankMode,
      exit,
      handleUploadDecision,
      helpGoToTab,
      helpNextTab,
      helpPanel.helpOpen,
      helpPrevTab,
      helpScrollDown,
      helpScrollUp,
      mode,
      navigateBottom,
      navigateDown,
      navigateIntoSelection,
      navigateTop,
      navigateUp,
      openHelp,
      pendingAction,
      pickerBottom,
      pickerCancelSearch,
      pickerClose,
      pickerConfirm,
      pickerMoveDown,
      pickerMoveUp,
      pickerStartSearch,
      pickerTop,
      pickers.activePicker,
      pushYankFeedback,
      refresh,
      resolve,
      resetChord,
      runAdapterAction,
      selectedRow,
      showDetails,
      startCommandMode,
      startSearchMode,
      submitPendingAction,
      uploadPending,
      yankMode,
      yankOptions,
    ],
  );

  useInput(handleInput, { isActive: true });
}
