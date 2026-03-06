import { useMemo } from "react";
import { COMMAND_MODE_HINT } from "../constants/commands.js";
import { buildScopeHint, type KeyBindingContext } from "../constants/keybindings.js";
import type { AdapterKeyBinding } from "../adapters/capabilities/ActionCapability.js";
import type { AppMode } from "../types.js";
import type { PickerManager } from "./usePickerManager.js";
import type { PendingAction } from "./usePendingAction.js";
import type { DescribeState, UploadPending } from "./useAppController.js";

export type UiScope =
  | "help"
  | "picker"
  | "adapter-action"
  | "upload"
  | "details"
  | "yank"
  | "search"
  | "command"
  | "navigate";

interface UseUiHintsArgs {
  mode: AppMode;
  helpOpen: boolean;
  pickers: PickerManager;
  pendingAction: PendingAction | null;
  uploadPending: UploadPending | null;
  describeState: DescribeState | null;
  yankMode: boolean;
  adapterBindings: AdapterKeyBinding[];
  yankHint: string;
  context: KeyBindingContext;
}

export function useUiHints({
  mode,
  helpOpen,
  pickers,
  pendingAction,
  uploadPending,
  describeState,
  yankMode,
  adapterBindings,
  yankHint,
  context,
}: UseUiHintsArgs) {
  const uiScope = useMemo<UiScope>(() => {
    if (helpOpen) return "help";
    if (pickers.activePicker) return "picker";
    if (pendingAction) return "adapter-action";
    if (uploadPending) return "upload";
    if (describeState) return "details";
    if (yankMode) return "yank";
    if (mode === "search") return "search";
    if (mode === "command") return "command";
    return "navigate";
  }, [describeState, helpOpen, mode, pendingAction, pickers.activePicker, uploadPending, yankMode]);

  const bottomHint = useMemo(() => {
    switch (uiScope) {
      case "help":
        return buildScopeHint("help", adapterBindings, 8, context);
      case "picker":
        return pickers.activePicker?.pickerMode === "search"
          ? buildScopeHint("search", adapterBindings, 8, context)
          : buildScopeHint("picker", adapterBindings, 8, context);
      case "adapter-action":
        if (pendingAction?.effect.type === "prompt") {
          return " Enter value  •  Esc cancel";
        }
        if (pendingAction?.effect.type === "confirm") {
          return " y confirm  •  n/Esc cancel";
        }
        return "";
      case "upload":
        return buildScopeHint("upload", adapterBindings, 8, context);
      case "details":
        return buildScopeHint("details", adapterBindings, 8, context);
      case "yank":
        return ` ${yankHint}`;
      case "search":
        return buildScopeHint("search", adapterBindings, 8, context);
      case "command":
        return COMMAND_MODE_HINT;
      case "navigate":
        return buildScopeHint("navigate", adapterBindings, 8, context);
      default:
        return "";
    }
  }, [adapterBindings, context, pendingAction, pickers.activePicker, uiScope, yankHint]);

  return {
    uiScope,
    bottomHint,
  };
}
