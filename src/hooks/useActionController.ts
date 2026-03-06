import { useCallback } from "react";
import type { ServiceAdapter } from "../adapters/ServiceAdapter.js";
import type { ActionEffect } from "../adapters/capabilities/ActionCapability.js";
import type { TableRow } from "../types.js";
import type { PendingAction } from "./usePendingAction.js";

interface UseActionControllerArgs {
  adapter: ServiceAdapter;
  refresh: () => Promise<void>;
  setPendingAction: (next: PendingAction | null) => void;
  pushFeedback: (message: string, durationMs?: number) => void;
}

export function useActionController({
  adapter,
  refresh,
  setPendingAction,
  pushFeedback,
}: UseActionControllerArgs) {
  const handleActionEffect = useCallback(
    (effect: ActionEffect, row: TableRow | null) => {
      switch (effect.type) {
        case "none":
          return;
        case "refresh":
          void refresh();
          return;
        case "feedback":
          pushFeedback(effect.message, 2500);
          setPendingAction(null);
          return;
        case "clipboard":
          pushFeedback(effect.feedback, 2500);
          setPendingAction(null);
          return;
        case "error":
          pushFeedback(effect.message, 3000);
          setPendingAction(null);
          return;
        case "prompt":
          setPendingAction({
            effect,
            row,
            inputValue: effect.defaultValue ?? "",
            accumulatedData: effect.data ?? {},
          });
          return;
        case "confirm":
          setPendingAction({
            effect,
            row,
            inputValue: "",
            accumulatedData: effect.data ?? {},
          });
      }
    },
    [pushFeedback, refresh, setPendingAction],
  );

  const submitPendingAction = useCallback(
    (pendingAction: PendingAction | null, confirmed: boolean) => {
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
          pushFeedback(`Action failed: ${(err as Error).message}`, 3000);
          setPendingAction(null);
        });
    },
    [adapter.capabilities?.actions, handleActionEffect, pushFeedback, setPendingAction],
  );

  return {
    handleActionEffect,
    submitPendingAction,
  };
}
