import type { TableRow } from "../../types.js";
import type { KeyTrigger, KeyScope, KeyBindingContext } from "../../constants/keybindings.js";

export interface AdapterKeyBinding {
  trigger: KeyTrigger;
  actionId: string;
  label: string;
  shortLabel?: string; // concise hint label; if omitted, label is used
  scope?: KeyScope; // defaults to "navigate"
  adapterId: string; // e.g., "s3", "secrets-manager", for hint prefixing
  priority?: number; // higher = more prominent; undefined = 100
  showIf?: (context: KeyBindingContext) => boolean; // conditional visibility
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
