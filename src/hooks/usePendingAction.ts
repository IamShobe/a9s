import { useState } from "react";
import type { TableRow } from "../types.js";
import type { ActionEffect } from "../adapters/capabilities/ActionCapability.js";

export interface PendingAction {
  effect: Extract<ActionEffect, { type: "prompt" | "confirm" }>;
  row: TableRow | null;
  inputValue: string;
  accumulatedData: Record<string, unknown>;
}

export function usePendingAction() {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  return {
    pendingAction,
    setPendingAction,
  };
}
