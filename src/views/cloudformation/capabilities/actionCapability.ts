import type {
  ActionCapability,
  AdapterKeyBinding,
  ActionContext,
  ActionEffect,
} from "../../../adapters/capabilities/ActionCapability.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import { toErrorMessage } from "../../../utils/errorHelpers.js";
import type { CloudFormationLevel, CloudFormationRowMeta } from "../types.js";

export function createCloudFormationActionCapability(
  region?: string,
  getLevel?: () => CloudFormationLevel,
): ActionCapability {
  const regionArgs = buildRegionArgs(region);

  const getKeybindings = (): AdapterKeyBinding[] => [
    {
      trigger: { type: "key", char: "D" },
      actionId: "delete-stack",
      label: "Delete stack",
      shortLabel: "delete stack",
      scope: "navigate",
      adapterId: "cloudformation",
    },
  ];

  const executeAction = async (actionId: string, context: ActionContext): Promise<ActionEffect> => {
    const level = getLevel?.();
    const meta = context.row?.meta as CloudFormationRowMeta | undefined;

    if (actionId === "delete-stack") {
      if (level?.kind !== "stacks") return { type: "none" };
      if (!meta || meta.type !== "stack") {
        return { type: "error", message: "Select a stack to delete" };
      }
      return {
        type: "confirm",
        message: `Delete stack ${meta.stackName}? This cannot be undone.`,
        nextActionId: "delete-stack:confirmed",
      };
    }

    if (actionId === "delete-stack:confirmed") {
      if (!meta || meta.type !== "stack") return { type: "error", message: "No stack selected" };
      try {
        await runAwsJsonAsync<unknown>([
          "cloudformation",
          "delete-stack",
          "--stack-name",
          meta.stackName,
          ...regionArgs,
        ]);
        return {
          type: "multi",
          effects: [
            { type: "feedback", message: `Deleting stack ${meta.stackName}` },
            { type: "refresh" },
          ],
        };
      } catch (err) {
        return { type: "error", message: `Delete failed: ${toErrorMessage(err)}` };
      }
    }

    return { type: "none" };
  };

  return { getKeybindings, executeAction };
}
