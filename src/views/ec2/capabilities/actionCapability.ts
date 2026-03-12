import type {
  ActionCapability,
  AdapterKeyBinding,
  ActionContext,
  ActionEffect,
} from "../../../adapters/capabilities/ActionCapability.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import { toErrorMessage } from "../../../utils/errorHelpers.js";
import type { EC2Level, EC2RowMeta } from "../types.js";

export function createEC2ActionCapability(
  region?: string,
  getLevel?: () => EC2Level,
): ActionCapability {
  const regionArgs = buildRegionArgs(region);

  const getKeybindings = (): AdapterKeyBinding[] => [
    {
      trigger: { type: "key", char: "s" },
      actionId: "start",
      label: "Start instance",
      shortLabel: "start",
      scope: "navigate",
      adapterId: "ec2",
    },
    {
      trigger: { type: "key", char: "S" },
      actionId: "stop",
      label: "Stop instance",
      shortLabel: "stop",
      scope: "navigate",
      adapterId: "ec2",
    },
    {
      trigger: { type: "key", char: "R" },
      actionId: "reboot",
      label: "Reboot instance",
      shortLabel: "reboot",
      scope: "navigate",
      adapterId: "ec2",
    },
  ];

  const executeAction = async (actionId: string, context: ActionContext): Promise<ActionEffect> => {
    const level = getLevel?.();
    if (level?.kind !== "instances") return { type: "none" };

    const meta = context.row?.meta as EC2RowMeta | undefined;
    if (!meta || meta.type !== "instance") {
      return { type: "error", message: "Select an instance to perform this action" };
    }

    const { instanceId, instanceName } = meta;
    const displayName = instanceName || instanceId;

    if (actionId === "start") {
      return {
        type: "confirm",
        message: `Start instance ${displayName}?`,
        nextActionId: "start:confirmed",
      };
    }

    if (actionId === "start:confirmed") {
      try {
        await runAwsJsonAsync<unknown>([
          "ec2",
          "start-instances",
          "--instance-ids",
          instanceId,
          ...regionArgs,
        ]);
        return { type: "feedback", message: `Starting instance ${displayName}` };
      } catch (err) {
        return { type: "error", message: `Failed to start: ${toErrorMessage(err)}` };
      }
    }

    if (actionId === "stop") {
      return {
        type: "confirm",
        message: `Stop instance ${displayName}?`,
        nextActionId: "stop:confirmed",
      };
    }

    if (actionId === "stop:confirmed") {
      try {
        await runAwsJsonAsync<unknown>([
          "ec2",
          "stop-instances",
          "--instance-ids",
          instanceId,
          ...regionArgs,
        ]);
        return { type: "feedback", message: `Stopping instance ${displayName}` };
      } catch (err) {
        return { type: "error", message: `Failed to stop: ${toErrorMessage(err)}` };
      }
    }

    if (actionId === "reboot") {
      return {
        type: "confirm",
        message: `Reboot instance ${displayName}?`,
        nextActionId: "reboot:confirmed",
      };
    }

    if (actionId === "reboot:confirmed") {
      try {
        await runAwsJsonAsync<unknown>([
          "ec2",
          "reboot-instances",
          "--instance-ids",
          instanceId,
          ...regionArgs,
        ]);
        return { type: "feedback", message: `Rebooting instance ${displayName}` };
      } catch (err) {
        return { type: "error", message: `Failed to reboot: ${toErrorMessage(err)}` };
      }
    }

    return { type: "none" };
  };

  return { getKeybindings, executeAction };
}
