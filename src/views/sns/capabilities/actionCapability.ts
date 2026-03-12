import type {
  ActionCapability,
  AdapterKeyBinding,
  ActionContext,
  ActionEffect,
} from "../../../adapters/capabilities/ActionCapability.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import { toErrorMessage } from "../../../utils/errorHelpers.js";
import type { SNSLevel, SNSRowMeta } from "../types.js";

export function createSNSActionCapability(
  region?: string,
  getLevel?: () => SNSLevel,
): ActionCapability {
  const regionArgs = buildRegionArgs(region);

  const getKeybindings = (): AdapterKeyBinding[] => [
    {
      trigger: { type: "key", char: "p" },
      actionId: "publish",
      label: "Publish message",
      shortLabel: "publish",
      scope: "navigate",
      adapterId: "sns",
    },
    {
      trigger: { type: "key", char: "D" },
      actionId: "delete-topic",
      label: "Delete topic",
      shortLabel: "delete topic",
      scope: "navigate",
      adapterId: "sns",
    },
    {
      trigger: { type: "key", char: "U" },
      actionId: "unsubscribe",
      label: "Unsubscribe",
      shortLabel: "unsubscribe",
      scope: "navigate",
      adapterId: "sns",
    },
  ];

  const executeAction = async (actionId: string, context: ActionContext): Promise<ActionEffect> => {
    const level = getLevel?.();
    const meta = context.row?.meta as SNSRowMeta | undefined;

    if (actionId === "publish") {
      if (level?.kind !== "topics") return { type: "none" };
      if (!meta || meta.type !== "topic") {
        return { type: "error", message: "Select a topic to publish to" };
      }
      return {
        type: "prompt",
        label: "Message:",
        defaultValue: "",
        nextActionId: "publish:submit",
      };
    }

    if (actionId === "publish:submit") {
      if (!meta || meta.type !== "topic") return { type: "error", message: "No topic selected" };
      const message = (context.data?.path as string | undefined) ?? "";
      if (!message.trim()) {
        return { type: "error", message: "Message cannot be empty" };
      }
      try {
        await runAwsJsonAsync<unknown>([
          "sns",
          "publish",
          "--topic-arn",
          meta.topicArn,
          "--message",
          message,
          ...regionArgs,
        ]);
        return { type: "feedback", message: `Published to ${meta.topicName}` };
      } catch (err) {
        return { type: "error", message: `Publish failed: ${toErrorMessage(err)}` };
      }
    }

    if (actionId === "delete-topic") {
      if (level?.kind !== "topics") return { type: "none" };
      if (!meta || meta.type !== "topic") {
        return { type: "error", message: "Select a topic to delete" };
      }
      return {
        type: "confirm",
        message: `Delete topic ${meta.topicName}?`,
        nextActionId: "delete-topic:confirmed",
      };
    }

    if (actionId === "delete-topic:confirmed") {
      if (!meta || meta.type !== "topic") return { type: "error", message: "No topic selected" };
      try {
        await runAwsJsonAsync<unknown>([
          "sns",
          "delete-topic",
          "--topic-arn",
          meta.topicArn,
          ...regionArgs,
        ]);
        return {
          type: "multi",
          effects: [
            { type: "feedback", message: `Deleted topic ${meta.topicName}` },
            { type: "refresh" },
          ],
        };
      } catch (err) {
        return { type: "error", message: `Delete failed: ${toErrorMessage(err)}` };
      }
    }

    if (actionId === "unsubscribe") {
      if (level?.kind !== "subscriptions") return { type: "none" };
      if (!meta || meta.type !== "subscription") {
        return { type: "error", message: "Select a subscription to remove" };
      }
      if (meta.subscriptionArn === "PendingConfirmation") {
        return { type: "error", message: "Cannot unsubscribe a pending subscription" };
      }
      return {
        type: "confirm",
        message: `Unsubscribe ${meta.protocol}:${meta.endpoint.slice(0, 40)}?`,
        nextActionId: "unsubscribe:confirmed",
      };
    }

    if (actionId === "unsubscribe:confirmed") {
      if (!meta || meta.type !== "subscription") return { type: "error", message: "No subscription selected" };
      try {
        await runAwsJsonAsync<unknown>([
          "sns",
          "unsubscribe",
          "--subscription-arn",
          meta.subscriptionArn,
          ...regionArgs,
        ]);
        return {
          type: "multi",
          effects: [
            { type: "feedback", message: "Unsubscribed" },
            { type: "refresh" },
          ],
        };
      } catch (err) {
        return { type: "error", message: `Unsubscribe failed: ${toErrorMessage(err)}` };
      }
    }

    return { type: "none" };
  };

  return { getKeybindings, executeAction };
}
