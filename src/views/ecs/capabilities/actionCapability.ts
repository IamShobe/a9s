import type {
  ActionCapability,
  AdapterKeyBinding,
  ActionContext,
  ActionEffect,
} from "../../../adapters/capabilities/ActionCapability.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import { toErrorMessage } from "../../../utils/errorHelpers.js";
import type { ECSLevel, ECSRowMeta } from "../types.js";

export function createECSActionCapability(
  region?: string,
  getLevel?: () => ECSLevel,
): ActionCapability {
  const regionArgs = buildRegionArgs(region);

  const getKeybindings = (): AdapterKeyBinding[] => [
    {
      trigger: { type: "key", char: "r" },
      actionId: "restart",
      label: "Force new deployment",
      shortLabel: "restart",
      scope: "navigate",
      adapterId: "ecs",
    },
    {
      trigger: { type: "key", char: "s" },
      actionId: "scale",
      label: "Scale service (set desired count)",
      shortLabel: "scale",
      scope: "navigate",
      adapterId: "ecs",
    },
  ];

  const executeAction = async (actionId: string, context: ActionContext): Promise<ActionEffect> => {
    const level = getLevel?.();
    if (level?.kind !== "services") return { type: "none" };

    const meta = context.row?.meta as ECSRowMeta | undefined;
    if (!meta || meta.type !== "service") {
      return { type: "error", message: "Select a service to perform this action" };
    }

    const { serviceArn, serviceName } = meta;

    if (actionId === "restart") {
      return {
        type: "confirm",
        message: `Force new deployment for ${serviceName}?`,
        nextActionId: "restart:confirmed",
      };
    }

    if (actionId === "restart:confirmed") {
      try {
        await runAwsJsonAsync<unknown>([
          "ecs",
          "update-service",
          "--cluster",
          level.clusterArn,
          "--service",
          serviceArn,
          "--force-new-deployment",
          ...regionArgs,
        ]);
        return { type: "feedback", message: `Restarting service ${serviceName}` };
      } catch (err) {
        return { type: "error", message: `Restart failed: ${toErrorMessage(err)}` };
      }
    }

    if (actionId === "scale") {
      return {
        type: "prompt",
        label: "Desired count:",
        defaultValue: "1",
        nextActionId: "scale:submit",
      };
    }

    if (actionId === "scale:submit") {
      const countStr = (context.data?.path as string | undefined) ?? "1";
      const count = parseInt(countStr, 10);
      if (isNaN(count) || count < 0) {
        return { type: "error", message: "Invalid count: must be a non-negative integer" };
      }

      try {
        await runAwsJsonAsync<unknown>([
          "ecs",
          "update-service",
          "--cluster",
          level.clusterArn,
          "--service",
          serviceArn,
          "--desired-count",
          String(count),
          ...regionArgs,
        ]);
        return {
          type: "multi",
          effects: [
            { type: "feedback", message: `Scaled ${serviceName} to ${count} tasks` },
            { type: "refresh" },
          ],
        };
      } catch (err) {
        return { type: "error", message: `Scale failed: ${toErrorMessage(err)}` };
      }
    }

    return { type: "none" };
  };

  return { getKeybindings, executeAction };
}
