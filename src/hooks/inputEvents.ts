import type { Key } from "ink";
import type { AppMode, TableRow } from "../types.js";

export interface InputRuntimeState {
  mode: AppMode;
  filterText: string;
  commandText: string;
  searchEntryFilter: string | null;
  yankMode: boolean;
  yankHelpOpen: boolean;
  selectedRow: TableRow | null;
  helpOpen: boolean;
  pickerMode: "navigate" | "search" | null;
  activePickerId: string | null;
  describeOpen: boolean;
  uploadPending: boolean;
  pendingActionType: "prompt" | "confirm" | null;
  histogramOpen: boolean;
  filePreviewOpen: boolean;
  previewFilterActive: boolean;
  previewYankMode: boolean;
}

export type InputEvent =
  | { scope: "system"; type: "ctrl-c" }
  | { scope: "raw"; type: "key"; input: string; key: Key }
  | { scope: "help"; type: "close" | "prevTab" | "nextTab" | "scrollUp" | "scrollDown" }
  | { scope: "help"; type: "goToTab"; input: string }
  | {
      scope: "picker";
      type: "close" | "cancelSearch" | "startSearch" | "down" | "up" | "top" | "bottom" | "confirm" | "deleteItem";
    }
  | {
      scope: "modal";
      type:
        | "openHelp"
        | "openYankHelp"
        | "closeYankHelp"
        | "closeDetails"
        | "cancelYank"
        | "cancelPendingPrompt"
        | "closeHistogram"
        | "closePreview"
        | "closePreviewFilter"
        | "openPreviewFilter"
        | "enterPreviewYank"
        | "cancelPreviewYank";
    }
  | { scope: "pending"; type: "submit"; confirmed: boolean }
  | { scope: "upload"; type: "decision"; confirmed: boolean }
  | {
      scope: "mode";
      type:
        | "cancelSearchOrCommand"
        | "clearFilterOrNavigateBack"
        | "startSearch"
        | "startCommand"
        | "commandAutocomplete"
        | "commandHistoryPrev"
        | "commandHistoryNext";
    }
  | {
      scope: "navigation";
      type:
        | "quit"
        | "refresh"
        | "reveal"
        | "enterYank"
        | "showDetails"
        | "edit"
        | "bottom"
        | "top"
        | "enter"
        | "relatedResources"
        | "openInBrowser"
        | "sortColumn"
        | "heatmapToggle"
        | "multiSelectToggle"
        | "multiSelectRange"
        | "multiSelectAll"
        | "bookmarkToggle"
        | "showHistogram"
        | "previewFile";
    }
  | { scope: "preview"; type: "nextPage" | "prevPage" | "scrollUp" | "scrollDown" | "colLeft" | "colRight" | "toTop" | "toBottom" | "showDetails" }
  | { scope: "preview"; type: "yankColumn"; colIndex: number }
  | { scope: "scroll"; type: "up" | "down" }
  | { scope: "adapterAction"; type: "run"; actionId: string; row: TableRow | null };

export type InputDispatcher = (event: InputEvent) => void;
