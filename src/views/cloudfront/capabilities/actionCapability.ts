import type {
  ActionCapability,
  AdapterKeyBinding,
  ActionContext,
  ActionEffect,
} from "../../../adapters/capabilities/ActionCapability.js";
import { runAwsJsonAsync } from "../../../utils/aws.js";
import { toErrorMessage } from "../../../utils/errorHelpers.js";
import type { CloudFrontLevel, CloudFrontRowMeta } from "../types.js";

export function createCloudFrontActionCapability(
  getLevel?: () => CloudFrontLevel,
): ActionCapability {
  const getKeybindings = (): AdapterKeyBinding[] => [
    {
      trigger: { type: "key", char: "i" },
      actionId: "create-invalidation",
      label: "Create invalidation",
      shortLabel: "invalidate",
      scope: "navigate",
      adapterId: "cloudfront",
    },
  ];

  const executeAction = async (actionId: string, context: ActionContext): Promise<ActionEffect> => {
    const level = getLevel?.();
    const meta = context.row?.meta as CloudFrontRowMeta | undefined;

    if (actionId === "create-invalidation") {
      if (level?.kind !== "distributions") return { type: "none" };
      if (!meta || meta.type !== "distribution") {
        return { type: "error", message: "Select a distribution to invalidate" };
      }
      return {
        type: "prompt",
        label: "Paths (space-separated):",
        defaultValue: "/*",
        nextActionId: "create-invalidation:submit",
      };
    }

    if (actionId === "create-invalidation:submit") {
      if (!meta || meta.type !== "distribution") {
        return { type: "error", message: "No distribution selected" };
      }
      const pathsInput = (context.data?.path as string | undefined) ?? "/*";
      const paths = pathsInput.trim().split(/\s+/).filter(Boolean);
      if (paths.length === 0) {
        return { type: "error", message: "At least one path is required" };
      }
      const invalidationBatch = JSON.stringify({
        Paths: { Quantity: paths.length, Items: paths },
        CallerReference: String(Date.now()),
      });
      try {
        await runAwsJsonAsync<unknown>([
          "cloudfront",
          "create-invalidation",
          "--distribution-id",
          meta.distributionId,
          "--invalidation-batch",
          invalidationBatch,
        ]);
        return {
          type: "multi",
          effects: [
            { type: "feedback", message: `Invalidation created for ${meta.domainName}` },
            { type: "refresh" },
          ],
        };
      } catch (err) {
        return { type: "error", message: `Create invalidation failed: ${toErrorMessage(err)}` };
      }
    }

    return { type: "none" };
  };

  return { getKeybindings, executeAction };
}
