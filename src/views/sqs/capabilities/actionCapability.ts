import type {
  ActionCapability,
  AdapterKeyBinding,
  ActionContext,
  ActionEffect,
} from "../../../adapters/capabilities/ActionCapability.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import { toErrorMessage } from "../../../utils/errorHelpers.js";
import type { SQSLevel, SQSRowMeta } from "../types.js";

export function createSQSActionCapability(
  region?: string,
  getLevel?: () => SQSLevel,
): ActionCapability {
  const regionArgs = buildRegionArgs(region);

  const getKeybindings = (): AdapterKeyBinding[] => [
    {
      trigger: { type: "key", char: "P" },
      actionId: "purge",
      label: "Purge queue",
      shortLabel: "purge",
      scope: "navigate",
      adapterId: "sqs",
    },
    {
      trigger: { type: "key", char: "s" },
      actionId: "send",
      label: "Send message",
      shortLabel: "send msg",
      scope: "navigate",
      adapterId: "sqs",
    },
  ];

  const executeAction = async (actionId: string, context: ActionContext): Promise<ActionEffect> => {
    const level = getLevel?.();
    const meta = context.row?.meta as SQSRowMeta | undefined;

    if (actionId === "purge") {
      if (level?.kind !== "queues") return { type: "none" };
      if (!meta || meta.type !== "queue") {
        return { type: "error", message: "Select a queue to purge" };
      }
      return {
        type: "confirm",
        message: `Purge all messages from ${meta.queueName}?`,
        nextActionId: "purge:confirmed",
      };
    }

    if (actionId === "purge:confirmed") {
      if (!meta || meta.type !== "queue") return { type: "error", message: "No queue selected" };
      try {
        await runAwsJsonAsync<unknown>([
          "sqs",
          "purge-queue",
          "--queue-url",
          meta.queueUrl,
          ...regionArgs,
        ]);
        return {
          type: "multi",
          effects: [
            { type: "feedback", message: `Purged ${meta.queueName}` },
            { type: "refresh" },
          ],
        };
      } catch (err) {
        return { type: "error", message: `Purge failed: ${toErrorMessage(err)}` };
      }
    }

    if (actionId === "send") {
      if (level?.kind !== "queues") return { type: "none" };
      if (!meta || meta.type !== "queue") {
        return { type: "error", message: "Select a queue to send a message" };
      }
      return {
        type: "prompt",
        label: "Message body:",
        defaultValue: "",
        nextActionId: "send:submit",
      };
    }

    if (actionId === "send:submit") {
      if (!meta || meta.type !== "queue") return { type: "error", message: "No queue selected" };
      const body = (context.data?.path as string | undefined) ?? "";
      if (!body.trim()) {
        return { type: "error", message: "Message body cannot be empty" };
      }
      try {
        await runAwsJsonAsync<unknown>([
          "sqs",
          "send-message",
          "--queue-url",
          meta.queueUrl,
          "--message-body",
          body,
          ...regionArgs,
        ]);
        return {
          type: "multi",
          effects: [
            { type: "feedback", message: `Message sent to ${meta.queueName}` },
            { type: "refresh" },
          ],
        };
      } catch (err) {
        return { type: "error", message: `Send failed: ${toErrorMessage(err)}` };
      }
    }

    return { type: "none" };
  };

  return { getKeybindings, executeAction };
}
