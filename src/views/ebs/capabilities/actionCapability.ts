import type {
  ActionCapability,
  AdapterKeyBinding,
  ActionContext,
  ActionEffect,
} from "../../../adapters/capabilities/ActionCapability.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import { toErrorMessage } from "../../../utils/errorHelpers.js";
import type { EBSLevel, EBSRowMeta } from "../types.js";

export function createEBSActionCapability(
  region?: string,
  getLevel?: () => EBSLevel,
): ActionCapability {
  const regionArgs = buildRegionArgs(region);

  const getKeybindings = (): AdapterKeyBinding[] => [
    {
      trigger: { type: "key", char: "c" },
      actionId: "create-snapshot",
      label: "Create snapshot",
      shortLabel: "snapshot",
      scope: "navigate",
      adapterId: "ebs",
    },
    {
      trigger: { type: "key", char: "D" },
      actionId: "detach",
      label: "Detach volume",
      shortLabel: "detach",
      scope: "navigate",
      adapterId: "ebs",
    },
  ];

  const executeAction = async (actionId: string, context: ActionContext): Promise<ActionEffect> => {
    const level = getLevel?.();

    const meta = context.row?.meta as EBSRowMeta | undefined;

    if (actionId === "create-snapshot") {
      if (level?.kind !== "volumes") return { type: "none" };
      if (!meta || meta.type !== "volume") {
        return { type: "error", message: "Select a volume to snapshot" };
      }
      return {
        type: "prompt",
        label: "Snapshot description:",
        defaultValue: `Snapshot of ${meta.volumeId}`,
        nextActionId: "create-snapshot:submit",
      };
    }

    if (actionId === "create-snapshot:submit") {
      if (!meta || meta.type !== "volume") return { type: "error", message: "No volume selected" };
      const description = (context.data?.path as string | undefined) ?? "";
      try {
        const result = await runAwsJsonAsync<{ SnapshotId: string }>([
          "ec2",
          "create-snapshot",
          "--volume-id",
          meta.volumeId,
          "--description",
          description,
          ...regionArgs,
        ]);
        return {
          type: "feedback",
          message: `Snapshot ${result.SnapshotId} initiated for ${meta.volumeId}`,
        };
      } catch (err) {
        return { type: "error", message: `Snapshot failed: ${toErrorMessage(err)}` };
      }
    }

    if (actionId === "detach") {
      if (level?.kind !== "volumes") return { type: "none" };
      if (!meta || meta.type !== "volume") {
        return { type: "error", message: "Select a volume to detach" };
      }
      if (!meta.attachedInstanceId) {
        return { type: "error", message: "Volume is not attached to any instance" };
      }
      return {
        type: "confirm",
        message: `Detach ${meta.volumeId} from ${meta.attachedInstanceId}?`,
        nextActionId: "detach:confirmed",
      };
    }

    if (actionId === "detach:confirmed") {
      if (!meta || meta.type !== "volume") return { type: "error", message: "No volume selected" };
      try {
        await runAwsJsonAsync<unknown>([
          "ec2",
          "detach-volume",
          "--volume-id",
          meta.volumeId,
          ...regionArgs,
        ]);
        return {
          type: "multi",
          effects: [
            { type: "feedback", message: `Detaching ${meta.volumeId}` },
            { type: "refresh" },
          ],
        };
      } catch (err) {
        return { type: "error", message: `Detach failed: ${toErrorMessage(err)}` };
      }
    }

    return { type: "none" };
  };

  return { getKeybindings, executeAction };
}
