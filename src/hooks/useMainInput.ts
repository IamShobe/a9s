import type { Dispatch, SetStateAction } from "react";
import { useEffect, useCallback } from "react";
import { useInput } from "ink";
import type { Key } from "ink";
import clipboardy from "clipboardy";
import type { AppMode, TableRow } from "../types.js";
import type { ServiceAdapter, YankOption } from "../adapters/ServiceAdapter.js";
import type { ActionEffect } from "../adapters/capabilities/ActionCapability.js";
import type { PendingAction } from "./usePendingAction.js";
import type { PickerManager } from "./usePickerManager.js";
import type { HelpPanelState } from "./useHelpPanel.js";
import type { YankFeedback } from "./useYankMode.js";
import { KEYBINDINGS } from "../constants/keybindings.js";
import { KB } from "../constants/keys.js";
import { useKeyChord, matchesTrigger } from "./useKeyChord.js";
import { AVAILABLE_COMMANDS } from "../constants/commands.js";
import type { ServiceId } from "../services.js";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

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
  setMode: (m: AppMode) => void;
  moveDown: () => void;
  moveUp: () => void;
  toTop: () => void;
  toBottom: () => void;
  navigateIntoSelection: () => void;
  navigateBack: () => void;
  editSelection: () => void;
  showDetails: () => void;
  closeDetails: () => void;
  refresh: () => Promise<void>;
  setCommandText: (v: string) => void;
  setCommandCursorToEndToken: Dispatch<SetStateAction<number>>;
  setYankMode: (v: boolean) => void;
  pushYankFeedback: (msg: string) => void;
  setYankFeedback: (v: YankFeedback | null) => void;
  handleFilterChange: (v: string) => void;
  setSearchEntryFilter: (v: string | null) => void;
  setUploadPending: (v: { filePath: string; metadata: Record<string, unknown> } | null) => void;
  setSelectedRegion: (r: string) => void;
  setSelectedProfile: (p: string) => void;
  switchAdapter: (id: ServiceId) => void;
  handleActionEffect: (effect: ActionEffect, row: TableRow | null) => void;
  submitPendingAction: (confirmed: boolean) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

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
  } = handlers;

  const { resolve, reset: resetChord } = useKeyChord(KEYBINDINGS);

  const getActivePicker = useCallback(() => {
    if (pickers.resource.open) {
      return {
        entry: pickers.resource,
        onConfirm: () => {
          if (pickers.resource.selectedRow) {
            switchAdapter(pickers.resource.selectedRow.id as ServiceId);
            pickers.resource.closePicker();
            setMode("navigate");
          }
        },
      };
    }
    if (pickers.region.open) {
      return {
        entry: pickers.region,
        onConfirm: () => {
          if (pickers.region.selectedRow) {
            setSelectedRegion(pickers.region.selectedRow.id);
            pickers.region.closePicker();
            setMode("navigate");
          }
        },
      };
    }
    if (pickers.profile.open) {
      return {
        entry: pickers.profile,
        onConfirm: () => {
          if (pickers.profile.selectedRow) {
            setSelectedProfile(pickers.profile.selectedRow.id);
            pickers.profile.closePicker();
            setMode("navigate");
          }
        },
      };
    }
    return null;
  }, [pickers.profile, pickers.region, pickers.resource, setMode, setSelectedProfile, setSelectedRegion, switchAdapter]);

  const handleActivePickerInput = useCallback(
    (input: string, key: Key): boolean => {
      const active = getActivePicker();
      if (!active) return false;

      if (mode === "search" && !key.escape) return true;

      const action = resolve(input, key, "picker");
      switch (action) {
        case KB.PICKER_CLOSE:
          resetChord();
          if (mode === "search") {
            active.entry.cancelSearch();
            setMode("navigate");
          } else {
            active.entry.closePicker();
            setMode("navigate");
          }
          return true;
        case KB.PICKER_FILTER:
          resetChord();
          if (mode !== "search") {
            active.entry.startSearch();
            setMode("search");
          }
          return true;
        case KB.PICKER_DOWN:
          resetChord();
          active.entry.moveDown();
          return true;
        case KB.PICKER_UP:
          resetChord();
          active.entry.moveUp();
          return true;
        case KB.PICKER_TOP:
          resetChord();
          active.entry.toTop();
          return true;
        case KB.PICKER_BOTTOM:
          resetChord();
          active.entry.toBottom();
          return true;
        case KB.PICKER_CONFIRM:
          resetChord();
          active.onConfirm();
          return true;
        default:
          return true;
      }
    },
    [getActivePicker, mode, resetChord, resolve, setMode],
  );

  // Ctrl-C fallback
  useEffect(() => {
    const handle = (data: Buffer) => {
      if (data.toString() === "\x03") exit();
    };
    process.stdin.on("data", handle);
    return () => { process.stdin.off("data", handle); };
  }, [exit]);

  const handleInput = useCallback(
    (input: string, key: Key) => {

      // ------------------------------------------------------------------ help
      if (helpPanel.helpOpen) {
        const action = resolve(input, key, "help");
        switch (action) {
          case KB.HELP_CLOSE:       resetChord(); helpPanel.close();         return;
          case KB.HELP_PREV_TAB:    resetChord(); helpPanel.goToPrevTab();   return;
          case KB.HELP_NEXT_TAB:    resetChord(); helpPanel.goToNextTab();   return;
          case KB.HELP_SCROLL_UP:   resetChord(); helpPanel.scrollUp();      return;
          case KB.HELP_SCROLL_DOWN: resetChord(); helpPanel.scrollDown();    return;
          default:
            if (/^[1-9]$/.test(input)) { resetChord(); helpPanel.goToTab(input); }
        }
        return;
      }

      // ---------------------------------------------------------------- pickers
      if (handleActivePickerInput(input, key)) return;

      // ------------------------------------------------------------------ ?
      if (input === "?") {
        resetChord();
        if (mode === "navigate" && !uploadPending && !describeState && !yankMode && !pendingAction) {
          helpPanel.open();
        }
        return;
      }

      // -------------------------------------------- pending action (prompt/confirm)
      if (pendingAction) {
        resetChord();
        if (pendingAction.effect.type === "prompt") {
          if (key.escape) {
            handleActionEffect({ type: "none" }, pendingAction.row);
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

      // -------------------------------------------------------------- upload confirm
      if (uploadPending) {
        resetChord();
        if (input === "y" || input === "Y") {
          void (async () => {
            try {
              await adapter.capabilities?.edit?.uploadFile(uploadPending.filePath, uploadPending.metadata);
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

      // --------------------------------------------------------------- details panel
      if (describeState) {
        resetChord();
        if (key.escape) closeDetails();
        return;
      }

      // ----------------------------------------------------------------- yank mode
      if (yankMode) {
        resetChord();
        if (!selectedRow) return;
        if (key.escape) {
          setYankMode(false);
        } else {
          const option = yankOptions.find((o) => matchesTrigger(input, key, o.trigger));
          if (option) {
            setYankMode(false);
            void option.resolve(selectedRow).then((value) => {
              if (value) void clipboardy.write(value).then(() => pushYankFeedback(option.feedback));
            });
          }
        }
        return;
      }

      // ----------------------------------------------------------------- escape
      if (key.escape) {
        resetChord();
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

      // ----------------------------------------------------------------- tab
      if (key.tab) {
        resetChord();
        if (mode === "command" && commandText) {
          const match = AVAILABLE_COMMANDS.find((cmd) =>
            cmd.toLowerCase().startsWith(commandText.toLowerCase()),
          );
          if (match) {
            setCommandText(match);
            setCommandCursorToEndToken((t) => t + 1);
          }
        }
        return;
      }

      // Text input modes (search/command) are handled by AutocompleteInput
      if (mode === "search" || mode === "command") return;

      // ------------------------------------------------------------- navigate mode
      const action = resolve(input, key, "navigate");
      switch (action) {
        case KB.SEARCH_MODE:
          setSearchEntryFilter(filterText);
          setMode("search");
          return;
        case KB.COMMAND_MODE:
          setCommandText("");
          setMode("command");
          return;
        case KB.QUIT:          exit();                                        return;
        case KB.REFRESH:       void refresh();                                return;
        case KB.YANK_MODE:     setYankMode(true);                             return;
        case KB.DETAILS:       showDetails();                                 return;
        case KB.EDIT:          editSelection();                               return;
        case KB.GO_BOTTOM:     toBottom();                                    return;
        case KB.GO_TOP:        toTop();                                       return;
        case KB.MOVE_DOWN:     moveDown();                                    return;
        case KB.MOVE_UP:       moveUp();                                      return;
        case KB.NAVIGATE_INTO: navigateIntoSelection();                       return;
        // null or unmatched: could be adapter action or chord in progress — check adapter
        default:
          // Try to match against adapter-specific keybindings
          if (adapter.capabilities?.actions) {
            const adapterBindings = adapter.capabilities.actions.getKeybindings();
            for (const binding of adapterBindings) {
              // Simple matching for now (just check char triggers)
              if (binding.trigger.type === "key" && binding.trigger.char === input) {
                // Dispatch adapter action
                void adapter.capabilities.actions
                  .executeAction(binding.actionId, { row: selectedRow })
                  .then((effect) => {
                    handleActionEffect(effect, selectedRow);
                  })
                  .catch((err) => {
                    console.error("Action failed:", (err as Error).message);
                  });
                resetChord();
                return;
              }
              // TODO: Handle chord and special key triggers
            }
          }
      }
    },
    [
      mode, filterText, commandText, searchEntryFilter, yankMode, yankOptions,
      selectedRow, describeState, uploadPending, pendingAction, adapter, pickers, helpPanel,
      exit, setMode, moveDown, moveUp, toTop, toBottom,
      navigateIntoSelection, navigateBack, editSelection, showDetails, closeDetails,
      refresh,
      setCommandText, setCommandCursorToEndToken,
      setYankMode, pushYankFeedback, setYankFeedback,
      handleFilterChange, setSearchEntryFilter, setUploadPending,
      handleActivePickerInput, handleActionEffect,
      resolve, resetChord,
    ],
  );

  useInput(handleInput, { isActive: true });
}
