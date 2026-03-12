import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import { runAwsJsonAsync, buildRegionArgs, resolveRegion } from "../../utils/aws.js";
import { createBackStackHelpers } from "../../adapters/backStackUtils.js";
import { atom, getDefaultStore } from "jotai";
import type { AwsLogEvent, AwsLogGroup, AwsLogStream, CloudWatchLevel, CloudWatchRowMeta } from "./types.js";
import { createCloudWatchDetailCapability } from "./capabilities/detailCapability.js";
import { createCloudWatchYankCapability } from "./capabilities/yankCapability.js";
import { createCloudWatchEditCapability } from "./capabilities/editCapability.js";
import { createCloudWatchActionCapability } from "./capabilities/actionCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";

interface CloudWatchNavFrame extends NavFrame {
  level: CloudWatchLevel;
}

export const cloudWatchLevelAtom = atom<CloudWatchLevel>({ kind: "log-groups" });
export const cloudWatchBackStackAtom = atom<CloudWatchNavFrame[]>([]);

function formatBytes(bytes?: number): string {
  if (bytes == null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTimestamp(ms?: number): string {
  if (ms == null) return "-";
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

export function createCloudWatchServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const store = getDefaultStore();
  const regionArgs = buildRegionArgs(region);

  const getLevel = () => store.get(cloudWatchLevelAtom);
  const setLevel = (level: CloudWatchLevel) => store.set(cloudWatchLevelAtom, level);
  const getBackStack = () => store.get(cloudWatchBackStackAtom);
  const setBackStack = (stack: CloudWatchNavFrame[]) => store.set(cloudWatchBackStackAtom, stack);

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "log-groups") {
      return [
        { key: "name", label: "Name" },
        { key: "retention", label: "Retention", width: 14 },
        { key: "stored", label: "Stored", width: 12 },
        { key: "lastEvent", label: "Last Event", width: 22 },
      ];
    }
    if (level.kind === "log-streams") {
      return [
        { key: "name", label: "Name" },
        { key: "lastEvent", label: "Last Event", width: 22 },
        { key: "stored", label: "Stored", width: 12 },
      ];
    }
    // log-events level
    return [
      { key: "timestamp", label: "Timestamp", width: 22 },
      { key: "message", label: "Message" },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "log-groups") {
      try {
        const data = await runAwsJsonAsync<{ logGroups: AwsLogGroup[] }>([
          "logs",
          "describe-log-groups",
          ...regionArgs,
        ]);

        return (data.logGroups ?? []).map((group) => ({
          id: group.arn ?? group.logGroupName,
          cells: {
            name: textCell(group.logGroupName),
            retention: textCell(
              group.retentionInDays != null ? `${group.retentionInDays}d` : "Never",
            ),
            stored: textCell(formatBytes(group.storedBytes)),
            lastEvent: textCell("-"),
          },
          meta: {
            type: "log-group",
            logGroupName: group.logGroupName,
            logGroupArn: group.arn ?? "",
            retentionInDays: group.retentionInDays ?? 0,
          } satisfies CloudWatchRowMeta,
        }));
      } catch (e) {
        debugLog("cloudwatch", "getRows (log-groups) failed", e);
        return [];
      }
    }

    if (level.kind === "log-streams") {
      const { logGroupName } = level;
      try {
        const data = await runAwsJsonAsync<{ logStreams: AwsLogStream[] }>([
          "logs",
          "describe-log-streams",
          "--log-group-name",
          logGroupName,
          "--order-by",
          "LastEventTime",
          "--descending",
          ...regionArgs,
        ]);

        return (data.logStreams ?? []).map((stream) => ({
          id: `${logGroupName}/${stream.logStreamName}`,
          cells: {
            name: textCell(stream.logStreamName),
            lastEvent: textCell(formatTimestamp(stream.lastEventTimestamp)),
            stored: textCell(formatBytes(stream.storedBytes)),
          },
          meta: {
            type: "log-stream",
            logGroupName,
            logStreamName: stream.logStreamName,
          } satisfies CloudWatchRowMeta,
        }));
      } catch (e) {
        debugLog("cloudwatch", "getRows (log-streams) failed", e);
        return [];
      }
    }

    // log-events level
    const { logGroupName, logStreamName } = level;
    try {
      const data = await runAwsJsonAsync<{ events: AwsLogEvent[] }>([
        "logs",
        "get-log-events",
        "--log-group-name",
        logGroupName,
        "--log-stream-name",
        logStreamName,
        "--limit",
        "200",
        ...regionArgs,
      ]);

      return (data.events ?? []).map((event, idx) => {
        const ts = formatTimestamp(event.timestamp);
        const msg = event.message.replace(/\n/g, " ").trimEnd();
        return {
          id: `${logStreamName}/${idx}/${event.timestamp}`,
          cells: {
            timestamp: textCell(ts),
            message: textCell(msg),
          },
          meta: {
            type: "log-event",
            logGroupName,
            logStreamName,
            timestamp: ts,
            message: event.message,
          } satisfies CloudWatchRowMeta,
        };
      });
    } catch (e) {
      debugLog("cloudwatch", "getRows (log-events) failed", e);
      return [];
    }
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    const meta = row.meta as CloudWatchRowMeta | undefined;

    if (level.kind === "log-groups") {
      if (!meta || meta.type !== "log-group") return { action: "none" };

      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({ kind: "log-streams", logGroupName: meta.logGroupName });
      return { action: "navigate" };
    }

    if (level.kind === "log-streams") {
      if (!meta || meta.type !== "log-stream") return { action: "none" };

      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({
        kind: "log-events",
        logGroupName: level.logGroupName,
        logStreamName: meta.logStreamName,
      });
      return { action: "navigate" };
    }

    // log-events level: leaf
    return { action: "none" };
  };

  const { canGoBack, goBack } = createBackStackHelpers(getLevel, setLevel, getBackStack, setBackStack);

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "log-groups") return "logs://";
    if (level.kind === "log-streams") return `logs://${level.logGroupName}`;
    return `logs://${level.logGroupName}/${level.logStreamName}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "log-groups") return "📋 CloudWatch Logs";
    if (level.kind === "log-streams") return `📋 ${level.logGroupName}`;
    return `📋 ${level.logStreamName}`;
  };

  const detailCapability = createCloudWatchDetailCapability(region, getLevel);
  const yankCapability = createCloudWatchYankCapability();
  const editCapability = createCloudWatchEditCapability(region, getLevel);
  const actionCapability = createCloudWatchActionCapability(region, getLevel);

  const getBrowserUrl = (row: TableRow): string | null => {
    const r = resolveRegion(region);
    const meta = row.meta as CloudWatchRowMeta | undefined;
    if (!meta) return null;
    if (meta.type === "log-group") {
      return `https://${r}.console.aws.amazon.com/cloudwatch/home?region=${r}#logsV2:log-groups/log-group/${encodeURIComponent(meta.logGroupName ?? "")}`;
    }
    if (meta.type === "log-stream") {
      return `https://${r}.console.aws.amazon.com/cloudwatch/home?region=${r}#logsV2:log-groups/log-group/${encodeURIComponent(meta.logGroupName ?? "")}/log-events/${encodeURIComponent(meta.logStreamName ?? "")}`;
    }
    return null;
  };

  return {
    id: "cloudwatch",
    label: "CloudWatch Logs",
    hudColor: SERVICE_COLORS.cloudwatch ?? { bg: "cyan", fg: "black" },
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    getPath,
    getContextLabel,
    getBrowserUrl,
    reset() {
      setLevel({ kind: "log-groups" });
      setBackStack([]);
    },
    capabilities: {
      detail: detailCapability,
      yank: yankCapability,
      edit: editCapability,
      actions: actionCapability,
    },
  };
}
