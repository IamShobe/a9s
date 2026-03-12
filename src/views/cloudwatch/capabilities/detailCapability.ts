import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { AwsLogGroup, AwsLogStream, CloudWatchLevel, CloudWatchRowMeta } from "../types.js";
import { debugLog } from "../../../utils/debugLogger.js";

function formatTimestamp(ms?: number): string {
  if (ms == null) return "-";
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

export function createCloudWatchDetailCapability(
  region?: string,
  getLevel?: () => CloudWatchLevel,
): DetailCapability {
  const regionArgs = buildRegionArgs(region);

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as CloudWatchRowMeta | undefined;
    if (!meta) return [];

    const level = getLevel?.();

    if (level?.kind === "log-groups" && meta.type === "log-group") {
      try {
        const data = await runAwsJsonAsync<{ logGroups: AwsLogGroup[] }>([
          "logs",
          "describe-log-groups",
          "--log-group-name-prefix",
          meta.logGroupName,
          ...regionArgs,
        ]);
        const group = data.logGroups?.find((g) => g.logGroupName === meta.logGroupName);
        if (!group) return [];

        const storedMB =
          group.storedBytes != null ? (group.storedBytes / 1024 / 1024).toFixed(2) : "-";

        return [
          { label: "Log Group", value: group.logGroupName },
          { label: "ARN", value: meta.logGroupArn || "-" },
          {
            label: "Retention",
            value: group.retentionInDays != null ? `${group.retentionInDays} days` : "Never expire",
          },
          { label: "Stored", value: `${storedMB} MB` },
          { label: "Metric Filters", value: String(group.metricFilterCount ?? 0) },
          {
            label: "Created",
            value: group.creationTime != null ? formatTimestamp(group.creationTime) : "-",
          },
        ];
      } catch (e) {
        debugLog("cloudwatch", "getDetails (log-group) failed", e);
        return [];
      }
    }

    if (level?.kind === "log-streams" && meta.type === "log-stream") {
      try {
        const data = await runAwsJsonAsync<{ logStreams: AwsLogStream[] }>([
          "logs",
          "describe-log-streams",
          "--log-group-name",
          level.logGroupName,
          "--log-stream-name-prefix",
          meta.logStreamName,
          ...regionArgs,
        ]);
        const stream = data.logStreams?.find((s) => s.logStreamName === meta.logStreamName);
        if (!stream) return [];

        return [
          { label: "Stream Name", value: stream.logStreamName },
          { label: "First Event", value: formatTimestamp(stream.firstEventTimestamp) },
          { label: "Last Event", value: formatTimestamp(stream.lastEventTimestamp) },
          { label: "Last Ingestion", value: formatTimestamp(stream.lastIngestionTime) },
        ];
      } catch (e) {
        debugLog("cloudwatch", "getDetails (log-stream) failed", e);
        return [];
      }
    }

    if (level?.kind === "log-events" && meta.type === "log-event") {
      return [
        { label: "Timestamp", value: meta.timestamp },
        { label: "Message", value: meta.message },
      ];
    }

    return [];
  };

  return { getDetails };
}
