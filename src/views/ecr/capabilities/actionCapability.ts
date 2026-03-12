import type {
  ActionCapability,
  AdapterKeyBinding,
  ActionContext,
  ActionEffect,
} from "../../../adapters/capabilities/ActionCapability.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import { toErrorMessage } from "../../../utils/errorHelpers.js";
import type { ECRLevel, ECRRowMeta } from "../types.js";

export function createECRActionCapability(
  region?: string,
  getLevel?: () => ECRLevel,
): ActionCapability {
  const regionArgs = buildRegionArgs(region);

  const getKeybindings = (): AdapterKeyBinding[] => [
    {
      trigger: { type: "key", char: "D" },
      actionId: "delete-image",
      label: "Delete image",
      shortLabel: "delete image",
      scope: "navigate",
      adapterId: "ecr",
    },
  ];

  const executeAction = async (actionId: string, context: ActionContext): Promise<ActionEffect> => {
    const level = getLevel?.();
    const meta = context.row?.meta as ECRRowMeta | undefined;

    if (actionId === "delete-image") {
      if (level?.kind !== "images") return { type: "none" };
      if (!meta || meta.type !== "image") {
        return { type: "error", message: "Select an image to delete" };
      }
      const label = meta.imageTag ? `${meta.repositoryName}:${meta.imageTag}` : meta.imageDigest.slice(0, 20);
      return {
        type: "confirm",
        message: `Delete image ${label}?`,
        nextActionId: "delete-image:confirmed",
      };
    }

    if (actionId === "delete-image:confirmed") {
      if (!meta || meta.type !== "image") return { type: "error", message: "No image selected" };
      const imageId = meta.imageTag
        ? `imageTag=${meta.imageTag}`
        : `imageDigest=${meta.imageDigest}`;
      try {
        await runAwsJsonAsync<unknown>([
          "ecr",
          "batch-delete-image",
          "--repository-name",
          meta.repositoryName,
          "--image-ids",
          imageId,
          ...regionArgs,
        ]);
        return {
          type: "multi",
          effects: [
            { type: "feedback", message: `Deleted image from ${meta.repositoryName}` },
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
