import { useCallback, useRef } from "react";
import type { Key } from "ink";
import type { AdapterKeyBinding } from "../adapters/capabilities/ActionCapability.js";
import type { YankOption } from "../adapters/capabilities/YankCapability.js";
import type { KeyAction } from "../constants/keys.js";
import { KB } from "../constants/keys.js";
import { KEYBINDINGS } from "../constants/keybindings.js";
import { useKeyChord, matchesTrigger } from "./useKeyChord.js";
import {
  resolveHelpScopeAction,
  resolveNavigateScopeAction,
  resolvePickerScopeAction,
} from "./mainInputScopes.js";
import type { InputDispatcher, InputEvent, InputRuntimeState } from "./inputEvents.js";

export interface InputEventActions {
  app: {
    exit: () => void;
  };
  help: {
    open: () => void;
    close: () => void;
    prevTab: () => void;
    nextTab: () => void;
    scrollUp: () => void;
    scrollDown: () => void;
    goToTab: (input: string) => void;
  };
  picker: {
    close: () => void;
    cancelSearch: () => void;
    startSearch: () => void;
    moveDown: () => void;
    moveUp: () => void;
    top: () => void;
    bottom: () => void;
    confirm: () => void;
  };
  mode: {
    cancelSearchOrCommand: () => void;
    clearFilterOrNavigateBack: () => void;
    startSearch: () => void;
    startCommand: () => void;
    commandAutocomplete: () => void;
    historyPrev: () => void;
    historyNext: () => void;
  };
  navigation: {
    refresh: () => void;
    revealToggle: () => void;
    showDetails: () => void;
    editSelection: () => void;
    top: () => void;
    bottom: () => void;
    enter: () => void;
    jumpToRelated: () => void;
    openInBrowser: () => void;
    sortColumn: () => void;
    heatmapToggle: () => void;
    multiSelectToggle: () => void;
    multiSelectRange: () => void;
    multiSelectAll: () => void;
    bookmarkToggle: () => void;
    showHistogram: () => void;
    previewFile: () => void;
  };
  preview: {
    close: () => void;
    openFilter: () => void;
    closeFilter: () => void;
    nextPage: () => void;
    prevPage: () => void;
    scrollUp: () => void;
    scrollDown: () => void;
    colLeft: () => void;
    colRight: () => void;
    toTop: () => void;
    toBottom: () => void;
    enterYank: () => void;
    cancelYank: () => void;
    yankColumn: (colIndex: number) => void;
  };
  scroll: {
    up: () => void;
    down: () => void;
  };
  yank: {
    enter: () => void;
    cancel: () => void;
    openHelp: () => void;
    closeHelp: () => void;
  };
  details: {
    close: () => void;
    closeHistogram: () => void;
  };
  pending: {
    cancelPrompt: () => void;
    submit: (confirmed: boolean) => void;
  };
  upload: {
    decide: (confirmed: boolean) => void;
  };
  adapterAction: {
    run: (actionId: string, row: InputRuntimeState["selectedRow"]) => void;
    bindings: AdapterKeyBinding[];
  };
}

interface TranslateRawDeps {
  resolve: (input: string, key: Key, scope: "help" | "picker" | "navigate") => KeyAction | null;
  hasCommandAutocomplete: (commandText: string) => boolean;
}

interface TranslationResult {
  event: InputEvent | null;
  resetChord: boolean;
}

export function translateRawInputEvent(
  input: string,
  key: Key,
  runtime: InputRuntimeState,
  deps: TranslateRawDeps,
): TranslationResult {
  if (runtime.helpOpen) {
    const action = resolveHelpScopeAction(input, deps.resolve(input, key, "help"));
    switch (action.type) {
      case "close":
        return { event: { scope: "help", type: "close" }, resetChord: true };
      case "prevTab":
        return { event: { scope: "help", type: "prevTab" }, resetChord: true };
      case "nextTab":
        return { event: { scope: "help", type: "nextTab" }, resetChord: true };
      case "scrollUp":
        return { event: { scope: "help", type: "scrollUp" }, resetChord: true };
      case "scrollDown":
        return { event: { scope: "help", type: "scrollDown" }, resetChord: true };
      case "goToTab":
        return {
          event: { scope: "help", type: "goToTab", input: action.input },
          resetChord: true,
        };
      case "none":
        return { event: null, resetChord: false };
    }
  }

  if (runtime.pickerMode) {
    const action = resolvePickerScopeAction(
      key,
      runtime.pickerMode,
      deps.resolve(input, key, "picker"),
    );

    switch (action.type) {
      case "consume":
        return { event: null, resetChord: false };
      case "close":
        return {
          event:
            runtime.pickerMode === "search"
              ? { scope: "picker", type: "cancelSearch" }
              : { scope: "picker", type: "close" },
          resetChord: true,
        };
      case "search":
        return { event: { scope: "picker", type: "startSearch" }, resetChord: true };
      case "down":
        return { event: { scope: "picker", type: "down" }, resetChord: true };
      case "up":
        return { event: { scope: "picker", type: "up" }, resetChord: true };
      case "top":
        return { event: { scope: "picker", type: "top" }, resetChord: true };
      case "bottom":
        return { event: { scope: "picker", type: "bottom" }, resetChord: true };
      case "confirm":
        return { event: { scope: "picker", type: "confirm" }, resetChord: true };
      case "none":
        return { event: null, resetChord: false };
    }
  }

  if (
    input === "?" &&
    runtime.mode === "navigate" &&
    !runtime.uploadPending &&
    !runtime.describeOpen &&
    !runtime.yankMode &&
    !runtime.pendingActionType
  ) {
    return { event: { scope: "modal", type: "openHelp" }, resetChord: true };
  }

  if (runtime.pendingActionType) {
    if (runtime.pendingActionType === "prompt" && key.escape) {
      return { event: { scope: "modal", type: "cancelPendingPrompt" }, resetChord: true };
    }
    if (runtime.pendingActionType === "confirm") {
      if (input === "y" || input === "Y") {
        return { event: { scope: "pending", type: "submit", confirmed: true }, resetChord: true };
      }
      if (input === "n" || input === "N" || key.escape) {
        return {
          event: { scope: "pending", type: "submit", confirmed: false },
          resetChord: true,
        };
      }
    }
    return { event: null, resetChord: true };
  }

  if (runtime.uploadPending) {
    const scrollAction = deps.resolve(input, key, "navigate");
    if (scrollAction === KB.MOVE_DOWN) {
      return { event: { scope: "scroll", type: "down" }, resetChord: true };
    }
    if (scrollAction === KB.MOVE_UP) {
      return { event: { scope: "scroll", type: "up" }, resetChord: true };
    }
    if (input === "y" || input === "Y") {
      return { event: { scope: "upload", type: "decision", confirmed: true }, resetChord: true };
    }
    if (input === "n" || input === "N" || key.escape) {
      return {
        event: { scope: "upload", type: "decision", confirmed: false },
        resetChord: true,
      };
    }
    return { event: null, resetChord: true };
  }

  if (runtime.describeOpen) {
    const scrollAction = deps.resolve(input, key, "navigate");
    if (scrollAction === KB.MOVE_DOWN) {
      return { event: { scope: "scroll", type: "down" }, resetChord: true };
    }
    if (scrollAction === KB.MOVE_UP) {
      return { event: { scope: "scroll", type: "up" }, resetChord: true };
    }
    if (key.escape) {
      return { event: { scope: "modal", type: "closeDetails" }, resetChord: true };
    }
    return { event: null, resetChord: true };
  }

  if (runtime.histogramOpen) {
    if (key.escape) {
      return { event: { scope: "modal", type: "closeHistogram" }, resetChord: true };
    }
    return { event: null, resetChord: true };
  }

  if (runtime.filePreviewOpen) {
    if (runtime.previewFilterActive) {
      // In filter mode — only Esc is captured here; text input is handled by the panel
      if (key.escape) {
        return { event: { scope: "modal", type: "closePreviewFilter" }, resetChord: true };
      }
      return { event: null, resetChord: false };
    }
    if (key.escape) {
      return { event: { scope: "modal", type: "closePreview" }, resetChord: true };
    }
    if (input === "]") {
      return { event: { scope: "preview", type: "nextPage" }, resetChord: true };
    }
    if (input === "[") {
      return { event: { scope: "preview", type: "prevPage" }, resetChord: true };
    }
    if (input === ">" || key.rightArrow) {
      return { event: { scope: "preview", type: "colRight" }, resetChord: true };
    }
    if (input === "<" || key.leftArrow) {
      return { event: { scope: "preview", type: "colLeft" }, resetChord: true };
    }
    if (input === "/") {
      return { event: { scope: "modal", type: "openPreviewFilter" }, resetChord: true };
    }
    if (input === "y") {
      return { event: { scope: "modal", type: "enterPreviewYank" }, resetChord: true };
    }
    const scrollAction = deps.resolve(input, key, "navigate");
    if (scrollAction === KB.MOVE_DOWN) {
      return { event: { scope: "preview", type: "scrollDown" }, resetChord: false };
    }
    if (scrollAction === KB.MOVE_UP) {
      return { event: { scope: "preview", type: "scrollUp" }, resetChord: false };
    }
    if (scrollAction === KB.GO_TOP) {
      return { event: { scope: "preview", type: "toTop" }, resetChord: true };
    }
    if (scrollAction === KB.GO_BOTTOM) {
      return { event: { scope: "preview", type: "toBottom" }, resetChord: true };
    }
    return { event: null, resetChord: false };
  }

  if (runtime.yankMode) {
    if (!runtime.selectedRow) {
      return { event: null, resetChord: true };
    }
    if (input === "?") {
      return { event: { scope: "modal", type: "openYankHelp" }, resetChord: true };
    }
    if (key.escape) {
      return { event: { scope: "modal", type: "cancelYank" }, resetChord: true };
    }

    return { event: null, resetChord: true };
  }

  if (key.escape) {
    if (runtime.mode === "search" || runtime.mode === "command") {
      return { event: { scope: "mode", type: "cancelSearchOrCommand" }, resetChord: true };
    }
    return { event: { scope: "mode", type: "clearFilterOrNavigateBack" }, resetChord: true };
  }

  if (key.tab) {
    const canAutocomplete =
      runtime.mode === "command" &&
      runtime.commandText.length > 0 &&
      deps.hasCommandAutocomplete(runtime.commandText);

    return {
      event: canAutocomplete ? { scope: "mode", type: "commandAutocomplete" } : null,
      resetChord: true,
    };
  }

  if (runtime.mode === "command") {
    if (key.upArrow) return { event: { scope: "mode", type: "commandHistoryPrev" }, resetChord: true };
    if (key.downArrow) return { event: { scope: "mode", type: "commandHistoryNext" }, resetChord: true };
    return { event: null, resetChord: false };
  }

  if (runtime.mode === "search") {
    return { event: null, resetChord: false };
  }

  const baseAction = deps.resolve(input, key, "navigate");
  // Check for scroll actions (j/k) first before other navigate actions
  if (baseAction === KB.MOVE_DOWN) {
    return { event: { scope: "scroll", type: "down" }, resetChord: false };
  }
  if (baseAction === KB.MOVE_UP) {
    return { event: { scope: "scroll", type: "up" }, resetChord: false };
  }

  const navAction = resolveNavigateScopeAction(baseAction);
  switch (navAction.type) {
    case "search":
      return { event: { scope: "mode", type: "startSearch" }, resetChord: false };
    case "command":
      return { event: { scope: "mode", type: "startCommand" }, resetChord: false };
    case "quit":
      return { event: { scope: "navigation", type: "quit" }, resetChord: false };
    case "refresh":
      return { event: { scope: "navigation", type: "refresh" }, resetChord: false };
    case "reveal":
      return { event: { scope: "navigation", type: "reveal" }, resetChord: false };
    case "yank":
      return { event: { scope: "navigation", type: "enterYank" }, resetChord: false };
    case "details":
      return { event: { scope: "navigation", type: "showDetails" }, resetChord: false };
    case "edit":
      return { event: { scope: "navigation", type: "edit" }, resetChord: false };
    case "bottom":
      return { event: { scope: "navigation", type: "bottom" }, resetChord: false };
    case "top":
      return { event: { scope: "navigation", type: "top" }, resetChord: false };
    case "enter":
      return { event: { scope: "navigation", type: "enter" }, resetChord: false };
    case "relatedResources":
      return { event: { scope: "navigation", type: "relatedResources" }, resetChord: true };
    case "openInBrowser":
      return { event: { scope: "navigation", type: "openInBrowser" }, resetChord: false };
    case "sortColumn":
      return { event: { scope: "navigation", type: "sortColumn" }, resetChord: false };
    case "heatmapToggle":
      return { event: { scope: "navigation", type: "heatmapToggle" }, resetChord: false };
    case "multiSelectToggle":
      return { event: { scope: "navigation", type: "multiSelectToggle" }, resetChord: false };
    case "multiSelectRange":
      return { event: { scope: "navigation", type: "multiSelectRange" }, resetChord: false };
    case "multiSelectAll":
      return { event: { scope: "navigation", type: "multiSelectAll" }, resetChord: false };
    case "bookmarkToggle":
      return { event: { scope: "navigation", type: "bookmarkToggle" }, resetChord: false };
    case "showHistogram":
      return { event: { scope: "navigation", type: "showHistogram" }, resetChord: false };
    case "previewFile":
      return { event: { scope: "navigation", type: "previewFile" }, resetChord: false };
    case "none":
      return { event: null, resetChord: false };
  }
}

interface AdapterBindingResolution {
  event: InputEvent | null;
  nextPending: string[];
  consumed: boolean;
}

export function resolveAdapterBindingEvent(
  input: string,
  key: Key,
  bindings: AdapterKeyBinding[],
  pending: string[],
  row: InputRuntimeState["selectedRow"],
): AdapterBindingResolution {
  const scoped = bindings.filter((binding) => (binding.scope ?? "navigate") === "navigate");
  const next = pending.length > 0 ? [...pending, input] : [input];

  const chordHit = scoped.find(
    (binding) =>
      binding.trigger.type === "chord" &&
      binding.trigger.keys.length === next.length &&
      binding.trigger.keys.every((k, i) => k === next[i]),
  );
  if (chordHit) {
    return {
      event: { scope: "adapterAction", type: "run", actionId: chordHit.actionId, row },
      nextPending: [],
      consumed: true,
    };
  }

  const isChordPrefix = scoped.some(
    (binding) =>
      binding.trigger.type === "chord" &&
      binding.trigger.keys.length > next.length &&
      binding.trigger.keys.slice(0, next.length).every((k, i) => k === next[i]),
  );
  if (isChordPrefix) {
    return { event: null, nextPending: next, consumed: true };
  }

  const directHit = scoped.find(
    (binding) => binding.trigger.type !== "chord" && matchesTrigger(input, key, binding.trigger),
  );
  if (directHit) {
    return {
      event: { scope: "adapterAction", type: "run", actionId: directHit.actionId, row },
      nextPending: [],
      consumed: true,
    };
  }

  return { event: null, nextPending: [], consumed: false };
}

export function applyInputEvent(event: InputEvent, actions: InputEventActions): void {
  switch (event.scope) {
    case "system":
      actions.app.exit();
      return;
    case "raw":
      return;
    case "help":
      switch (event.type) {
        case "close":
          actions.help.close();
          return;
        case "prevTab":
          actions.help.prevTab();
          return;
        case "nextTab":
          actions.help.nextTab();
          return;
        case "scrollUp":
          actions.help.scrollUp();
          return;
        case "scrollDown":
          actions.help.scrollDown();
          return;
        case "goToTab":
          actions.help.goToTab(event.input);
          return;
      }
      return;
    case "picker":
      switch (event.type) {
        case "close":
          actions.picker.close();
          return;
        case "cancelSearch":
          actions.picker.cancelSearch();
          return;
        case "startSearch":
          actions.picker.startSearch();
          return;
        case "down":
          actions.picker.moveDown();
          return;
        case "up":
          actions.picker.moveUp();
          return;
        case "top":
          actions.picker.top();
          return;
        case "bottom":
          actions.picker.bottom();
          return;
        case "confirm":
          actions.picker.confirm();
          return;
      }
      return;
    case "modal":
      switch (event.type) {
        case "openHelp":
          actions.help.open();
          return;
        case "openYankHelp":
          actions.yank.openHelp();
          return;
        case "closeYankHelp":
          actions.yank.closeHelp();
          return;
        case "closeDetails":
          actions.details.close();
          return;
        case "cancelYank":
          actions.yank.cancel();
          return;
        case "cancelPendingPrompt":
          actions.pending.cancelPrompt();
          return;
        case "closeHistogram":
          actions.details.closeHistogram();
          return;
        case "closePreview":
          actions.preview.close();
          return;
        case "closePreviewFilter":
          actions.preview.closeFilter();
          return;
        case "openPreviewFilter":
          actions.preview.openFilter();
          return;
        case "enterPreviewYank":
          actions.preview.enterYank();
          return;
        case "cancelPreviewYank":
          actions.preview.cancelYank();
          return;
      }
      return;
    case "pending":
      actions.pending.submit(event.confirmed);
      return;
    case "upload":
      actions.upload.decide(event.confirmed);
      return;
    case "mode":
      switch (event.type) {
        case "cancelSearchOrCommand":
          actions.mode.cancelSearchOrCommand();
          return;
        case "clearFilterOrNavigateBack":
          actions.mode.clearFilterOrNavigateBack();
          return;
        case "startSearch":
          actions.mode.startSearch();
          return;
        case "startCommand":
          actions.mode.startCommand();
          return;
        case "commandAutocomplete":
          actions.mode.commandAutocomplete();
          return;
        case "commandHistoryPrev":
          actions.mode.historyPrev();
          return;
        case "commandHistoryNext":
          actions.mode.historyNext();
          return;
      }
      return;
    case "navigation":
      switch (event.type) {
        case "quit":
          actions.app.exit();
          return;
        case "refresh":
          actions.navigation.refresh();
          return;
        case "reveal":
          actions.navigation.revealToggle();
          return;
        case "enterYank":
          actions.yank.enter();
          return;
        case "showDetails":
          actions.navigation.showDetails();
          return;
        case "edit":
          actions.navigation.editSelection();
          return;
        case "bottom":
          actions.navigation.bottom();
          return;
        case "top":
          actions.navigation.top();
          return;
        case "enter":
          actions.navigation.enter();
          return;
        case "relatedResources":
          actions.navigation.jumpToRelated();
          return;
        case "openInBrowser":
          actions.navigation.openInBrowser();
          return;
        case "sortColumn":
          actions.navigation.sortColumn();
          return;
        case "heatmapToggle":
          actions.navigation.heatmapToggle();
          return;
        case "multiSelectToggle":
          actions.navigation.multiSelectToggle();
          return;
        case "multiSelectRange":
          actions.navigation.multiSelectRange();
          return;
        case "multiSelectAll":
          actions.navigation.multiSelectAll();
          return;
        case "bookmarkToggle":
          actions.navigation.bookmarkToggle();
          return;
        case "showHistogram":
          actions.navigation.showHistogram();
          return;
        case "previewFile":
          actions.navigation.previewFile();
          return;
      }
      return;
    case "preview":
      switch (event.type) {
        case "nextPage":
          actions.preview.nextPage();
          return;
        case "prevPage":
          actions.preview.prevPage();
          return;
        case "scrollDown":
          actions.preview.scrollDown();
          return;
        case "scrollUp":
          actions.preview.scrollUp();
          return;
        case "colLeft":
          actions.preview.colLeft();
          return;
        case "colRight":
          actions.preview.colRight();
          return;
        case "toTop":
          actions.preview.toTop();
          return;
        case "toBottom":
          actions.preview.toBottom();
          return;
        case "yankColumn":
          actions.preview.yankColumn(event.colIndex);
          return;
      }
      return;
    case "scroll":
      switch (event.type) {
        case "up":
          actions.scroll.up();
          return;
        case "down":
          actions.scroll.down();
          return;
      }
      return;
    case "adapterAction":
      actions.adapterAction.run(event.actionId, event.row);
      return;
  }
}

interface UseInputEventProcessorArgs {
  runtime: InputRuntimeState;
  actions: InputEventActions;
  yankOptions: YankOption[];
  pushYankFeedback: (message: string, durationMs?: number) => void;
  writeClipboard: (value: string) => Promise<void>;
  hasCommandAutocomplete: (commandText: string) => boolean;
}

export function useInputEventProcessor({
  runtime,
  actions,
  yankOptions,
  pushYankFeedback,
  writeClipboard,
  hasCommandAutocomplete,
}: UseInputEventProcessorArgs): InputDispatcher {
  const { resolve, reset } = useKeyChord(KEYBINDINGS);
  const adapterPendingRef = useRef<string[]>([]);
  const pendingYankHelpRef = useRef(false);

  const resetAllChords = useCallback(() => {
    reset();
    adapterPendingRef.current = [];
  }, [reset]);

  return useCallback(
    (event: InputEvent) => {
      if (event.scope === "raw") {
        // Support fast "y ?" combo even before yankMode state is committed.
        if (pendingYankHelpRef.current) {
          if (event.input === "?") {
            pendingYankHelpRef.current = false;
            resetAllChords();
            actions.yank.openHelp();
            return;
          }
          pendingYankHelpRef.current = false;
        }

        if (runtime.yankHelpOpen) {
          if (event.input === "?" || event.key.escape) {
            resetAllChords();
            actions.yank.closeHelp();
          }
          return;
        }

        if (runtime.yankMode) {
          if (!runtime.selectedRow) {
            resetAllChords();
            return;
          }
          if (event.input === "?") {
            resetAllChords();
            actions.yank.openHelp();
            return;
          }
          if (event.key.escape) {
            resetAllChords();
            actions.yank.cancel();
            return;
          }

          const option = yankOptions.find((o) => matchesTrigger(event.input, event.key, o.trigger));
          resetAllChords();
          if (!option) return;
          actions.yank.cancel();
          void option.resolve(runtime.selectedRow).then((value) => {
            if (!value) return;
            void writeClipboard(value).then(() => pushYankFeedback(option.feedback));
          });
          return;
        }

        if (runtime.filePreviewOpen && runtime.previewYankMode) {
          resetAllChords();
          if (event.key.escape) {
            actions.preview.cancelYank();
            return;
          }
          if (event.input.length === 1 && event.input >= "a" && event.input <= "z") {
            actions.preview.yankColumn(event.input.charCodeAt(0) - 97);
            return;
          }
          return;
        }

        const translated = translateRawInputEvent(event.input, event.key, runtime, {
          resolve: (input, key, scope) => resolve(input, key, scope),
          hasCommandAutocomplete,
        });

        if (translated.resetChord) {
          resetAllChords();
        }
        if (translated.event) {
          if (translated.event.scope === "navigation" && translated.event.type === "enterYank") {
            pendingYankHelpRef.current = true;
          }
          applyInputEvent(translated.event, actions);
          return;
        }

        // Adapter bindings must never fire while the user is typing (command/search mode).
        if (runtime.mode !== "navigate") {
          return;
        }

        const adapterResolved = resolveAdapterBindingEvent(
          event.input,
          event.key,
          actions.adapterAction.bindings,
          adapterPendingRef.current,
          runtime.selectedRow,
        );

        adapterPendingRef.current = adapterResolved.nextPending;
        if (adapterResolved.event) {
          reset();
          applyInputEvent(adapterResolved.event, actions);
          return;
        }
        return;
      }

      if (event.scope === "system") {
        applyInputEvent(event, actions);
      }
    },
    [
      actions,
      hasCommandAutocomplete,
      pushYankFeedback,
      reset,
      resetAllChords,
      resolve,
      runtime,
      writeClipboard,
      yankOptions,
    ],
  );
}
