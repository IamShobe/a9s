import type { TableRow } from "../../types.js";
import type { KeyTrigger, KeyScope } from "../../constants/keybindings.js";

export interface AdapterKeyBinding {
  trigger: KeyTrigger;
  actionId: string;
  label: string;
  scope?: KeyScope; // defaults to "navigate"
}

export interface ActionContext {
  row: TableRow | null;
  region?: string;
  profile?: string;
  data?: Record<string, unknown>;
}

export type ActionEffectSingle =
  | { type: "none" }
  | { type: "refresh" }
  | { type: "feedback"; message: string }
  | { type: "clipboard"; value: string; feedback: string }
  | {
      type: "prompt";
      label: string;
      defaultValue?: string;
      nextActionId: string;
      data?: Record<string, unknown>;
    }
  | {
      type: "confirm";
      message: string;
      nextActionId: string;
      data?: Record<string, unknown>;
    }
  | { type: "error"; message: string };

export type ActionEffect =
  | ActionEffectSingle
  | { type: "multi"; effects: ActionEffectSingle[] };

export interface ActionCapability {
  getKeybindings(): AdapterKeyBinding[];
  executeAction(actionId: string, context: ActionContext): Promise<ActionEffect>;
}
