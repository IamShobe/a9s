import type {
  ActionCapability,
  AdapterKeyBinding,
  ActionContext,
  ActionEffect,
} from "../../../adapters/capabilities/ActionCapability.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import { toErrorMessage } from "../../../utils/errorHelpers.js";
import type { AwsLogEvent, CloudWatchLevel, CloudWatchRowMeta } from "../types.js";

function formatTimestamp(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

export function createCloudWatchActionCapability(
  region?: string,
  getLevel?: () => CloudWatchLevel,
): ActionCapability {
  const regionArgs = buildRegionArgs(region);

  const getKeybindings = (): AdapterKeyBinding[] => [
    {
      trigger: { type: "key", char: "t" },
      actionId: "tail",
      label: "Tail last 50 events",
      shortLabel: "tail",
      scope: "navigate",
      adapterId: "cloudwatch",
    },
    {
      trigger: { type: "key", char: "r" },
      actionId: "set-retention",
      label: "Set retention policy",
      shortLabel: "retention",
      scope: "navigate",
      adapterId: "cloudwatch",
    },
  ];

  const executeAction = async (actionId: string, context: ActionContext): Promise<ActionEffect> => {
    const level = getLevel?.();

    if (actionId === "tail") {
      if (level?.kind !== "log-streams") return { type: "none" };

      const meta = context.row?.meta as CloudWatchRowMeta | undefined;
      if (!meta || meta.type !== "log-stream") {
        return { type: "error", message: "Select a log stream to tail" };
      }

      try {
        const data = await runAwsJsonAsync<{ events: AwsLogEvent[] }>([
          "logs",
          "get-log-events",
          "--log-group-name",
          level.logGroupName,
          "--log-stream-name",
          meta.logStreamName,
          "--limit",
          "50",
          "--start-from-head",
          "false",
          ...regionArgs,
        ]);

        const events = data.events ?? [];
        if (events.length === 0) {
          return { type: "feedback", message: "No events in this stream" };
        }

        const lines = events
          .slice(-10)
          .map((e) => `[${formatTimestamp(e.timestamp)}] ${e.message.trimEnd()}`);
        const header =
          events.length > 10 ? `(showing last 10 of ${events.length} events)\n` : "";

        return {
          type: "feedback",
          message: header + lines.join("\n"),
        };
      } catch (err) {
        return { type: "error", message: `Tail failed: ${toErrorMessage(err)}` };
      }
    }

    if (actionId === "set-retention") {
      if (level?.kind !== "log-groups") return { type: "none" };

      const meta = context.row?.meta as CloudWatchRowMeta | undefined;
      if (!meta || meta.type !== "log-group") {
        return { type: "error", message: "Select a log group to set retention" };
      }

      return {
        type: "prompt",
        label: "Retention days (0 = never expire):",
        defaultValue: meta.retentionInDays > 0 ? String(meta.retentionInDays) : "0",
        nextActionId: "set-retention:submit",
      };
    }

    if (actionId === "set-retention:submit") {
      if (level?.kind !== "log-groups") return { type: "none" };

      const meta = context.row?.meta as CloudWatchRowMeta | undefined;
      if (!meta || meta.type !== "log-group") {
        return { type: "error", message: "No log group selected" };
      }

      const daysStr = (context.data?.path as string | undefined) ?? "0";
      const days = parseInt(daysStr, 10);
      if (isNaN(days) || days < 0) {
        return { type: "error", message: "Invalid retention: must be a non-negative integer" };
      }

      try {
        if (days === 0) {
          await runAwsJsonAsync<unknown>([
            "logs",
            "delete-retention-policy",
            "--log-group-name",
            meta.logGroupName,
            ...regionArgs,
          ]);
          return {
            type: "multi",
            effects: [
              { type: "feedback", message: `Removed retention policy from ${meta.logGroupName}` },
              { type: "refresh" },
            ],
          };
        } else {
          await runAwsJsonAsync<unknown>([
            "logs",
            "put-retention-policy",
            "--log-group-name",
            meta.logGroupName,
            "--retention-in-days",
            String(days),
            ...regionArgs,
          ]);
          return {
            type: "multi",
            effects: [
              {
                type: "feedback",
                message: `Set retention to ${days} days on ${meta.logGroupName}`,
              },
              { type: "refresh" },
            ],
          };
        }
      } catch (err) {
        return { type: "error", message: `Set retention failed: ${toErrorMessage(err)}` };
      }
    }

    return { type: "none" };
  };

  return { getKeybindings, executeAction };
}
