import { useCallback, useMemo, useReducer } from "react";
import type { SetStateAction } from "react";
import type { AppMode, TableRow } from "../types.js";
import type { DetailField } from "../adapters/ServiceAdapter.js";
import type { PendingAction } from "./usePendingAction.js";
import { useTimedFeedback } from "./useTimedFeedback.js";

export interface UploadPending {
  filePath: string;
  metadata: Record<string, unknown>;
}

export interface DescribeState {
  row: TableRow;
  fields: DetailField[] | null;
  loading: boolean;
  requestId: number;
}

export interface AppControllerState {
  mode: AppMode;
  filterText: string;
  commandText: string;
  searchEntryFilter: string | null;
  commandCursorToEndToken: number;
  yankMode: boolean;
  yankHelpOpen: boolean;
  uploadPending: UploadPending | null;
  describeState: DescribeState | null;
  pendingAction: PendingAction | null;
}

type AppControllerAction =
  | { type: "setMode"; mode: AppMode }
  | { type: "setFilterText"; value: string }
  | { type: "setCommandText"; value: string }
  | { type: "setSearchEntryFilter"; value: string | null }
  | { type: "bumpCommandCursorToEnd" }
  | { type: "setYankMode"; value: boolean }
  | { type: "setYankHelpOpen"; value: boolean }
  | { type: "setUploadPending"; value: UploadPending | null }
  | { type: "setDescribeState"; value: SetStateAction<DescribeState | null> }
  | { type: "setPendingAction"; value: PendingAction | null }
  | { type: "setPendingInputValue"; value: string };

export const initialAppControllerState: AppControllerState = {
  mode: "navigate",
  filterText: "",
  commandText: "",
  searchEntryFilter: null,
  commandCursorToEndToken: 0,
  yankMode: false,
  yankHelpOpen: false,
  uploadPending: null,
  describeState: null,
  pendingAction: null,
};

export function appControllerReducer(
  state: AppControllerState,
  action: AppControllerAction,
): AppControllerState {
  switch (action.type) {
    case "setMode":
      return { ...state, mode: action.mode };
    case "setFilterText":
      return { ...state, filterText: action.value };
    case "setCommandText":
      return { ...state, commandText: action.value };
    case "setSearchEntryFilter":
      return { ...state, searchEntryFilter: action.value };
    case "bumpCommandCursorToEnd":
      return {
        ...state,
        commandCursorToEndToken: state.commandCursorToEndToken + 1,
      };
    case "setYankMode":
      return { ...state, yankMode: action.value };
    case "setYankHelpOpen":
      return { ...state, yankHelpOpen: action.value };
    case "setUploadPending":
      return { ...state, uploadPending: action.value };
    case "setDescribeState":
      return {
        ...state,
        describeState:
          typeof action.value === "function" ? action.value(state.describeState) : action.value,
      };
    case "setPendingAction":
      return { ...state, pendingAction: action.value };
    case "setPendingInputValue":
      return state.pendingAction
        ? {
            ...state,
            pendingAction: {
              ...state.pendingAction,
              inputValue: action.value,
            },
          }
        : state;
    default:
      return state;
  }
}

export function useAppController() {
  const [state, dispatch] = useReducer(appControllerReducer, initialAppControllerState);
  const { feedback: yankFeedbackMessage, pushFeedback, clearFeedback } = useTimedFeedback(1500);

  const actions = useMemo(
    () => ({
      setMode: (mode: AppMode) => dispatch({ type: "setMode", mode }),
      setFilterText: (value: string) => dispatch({ type: "setFilterText", value }),
      setCommandText: (value: string) => dispatch({ type: "setCommandText", value }),
      setSearchEntryFilter: (value: string | null) =>
        dispatch({ type: "setSearchEntryFilter", value }),
      bumpCommandCursorToEnd: () => dispatch({ type: "bumpCommandCursorToEnd" }),
      setYankMode: (value: boolean) => dispatch({ type: "setYankMode", value }),
      setYankHelpOpen: (value: boolean) => dispatch({ type: "setYankHelpOpen", value }),
      setUploadPending: (value: UploadPending | null) =>
        dispatch({ type: "setUploadPending", value }),
      setDescribeState: (value: SetStateAction<DescribeState | null>) =>
        dispatch({ type: "setDescribeState", value }),
      setPendingAction: (value: PendingAction | null) =>
        dispatch({ type: "setPendingAction", value }),
      setPendingInputValue: (value: string) => dispatch({ type: "setPendingInputValue", value }),
      clearFeedback,
      pushFeedback,
    }),
    [clearFeedback, pushFeedback],
  );

  return {
    state,
    actions,
    yankFeedbackMessage,
  };
}
