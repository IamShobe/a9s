import type {
  ActionCapability,
  AdapterKeyBinding,
  ActionContext,
  ActionEffect,
} from "../../../adapters/capabilities/ActionCapability.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import { toErrorMessage } from "../../../utils/errorHelpers.js";
import type { RDSLevel, RDSRowMeta } from "../types.js";

export function createRDSActionCapability(
  region?: string,
  getLevel?: () => RDSLevel,
): ActionCapability {
  const regionArgs = buildRegionArgs(region);

  const getKeybindings = (): AdapterKeyBinding[] => [
    {
      trigger: { type: "key", char: "R" },
      actionId: "reboot",
      label: "Reboot instance",
      shortLabel: "reboot",
      scope: "navigate",
      adapterId: "rds",
    },
    {
      trigger: { type: "key", char: "c" },
      actionId: "create-snapshot",
      label: "Create snapshot",
      shortLabel: "snapshot",
      scope: "navigate",
      adapterId: "rds",
    },
  ];

  const executeAction = async (actionId: string, context: ActionContext): Promise<ActionEffect> => {
    const level = getLevel?.();
    const meta = context.row?.meta as RDSRowMeta | undefined;

    if (actionId === "reboot") {
      if (level?.kind !== "instances") return { type: "none" };
      if (!meta || meta.type !== "instance") {
        return { type: "error", message: "Select an instance to reboot" };
      }
      return {
        type: "confirm",
        message: `Reboot ${meta.dbInstanceIdentifier}?`,
        nextActionId: "reboot:confirmed",
      };
    }

    if (actionId === "reboot:confirmed") {
      if (!meta || meta.type !== "instance") return { type: "error", message: "No instance selected" };
      try {
        await runAwsJsonAsync<unknown>([
          "rds",
          "reboot-db-instance",
          "--db-instance-identifier",
          meta.dbInstanceIdentifier,
          ...regionArgs,
        ]);
        return {
          type: "multi",
          effects: [
            { type: "feedback", message: `Rebooting ${meta.dbInstanceIdentifier}` },
            { type: "refresh" },
          ],
        };
      } catch (err) {
        return { type: "error", message: `Reboot failed: ${toErrorMessage(err)}` };
      }
    }

    if (actionId === "create-snapshot") {
      if (level?.kind !== "instances") return { type: "none" };
      if (!meta || meta.type !== "instance") {
        return { type: "error", message: "Select an instance to snapshot" };
      }
      return {
        type: "prompt",
        label: "Snapshot identifier suffix (leave blank for auto):",
        defaultValue: "",
        nextActionId: "create-snapshot:submit",
      };
    }

    if (actionId === "create-snapshot:submit") {
      if (!meta || meta.type !== "instance") return { type: "error", message: "No instance selected" };
      const suffix = (context.data?.path as string | undefined)?.trim() ?? "";
      const snapshotId = suffix
        ? `${meta.dbInstanceIdentifier}-${suffix}`
        : `${meta.dbInstanceIdentifier}-${Date.now()}`;
      try {
        const result = await runAwsJsonAsync<{ DBSnapshot: { DBSnapshotIdentifier: string } }>([
          "rds",
          "create-db-snapshot",
          "--db-instance-identifier",
          meta.dbInstanceIdentifier,
          "--db-snapshot-identifier",
          snapshotId,
          ...regionArgs,
        ]);
        return {
          type: "feedback",
          message: `Snapshot ${result.DBSnapshot?.DBSnapshotIdentifier ?? snapshotId} initiated`,
        };
      } catch (err) {
        return { type: "error", message: `Snapshot failed: ${toErrorMessage(err)}` };
      }
    }

    return { type: "none" };
  };

  return { getKeybindings, executeAction };
}
