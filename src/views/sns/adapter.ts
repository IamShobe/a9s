import type { ServiceAdapter, RelatedResource } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import { statusCell } from "../../utils/statusColors.js";
import { runAwsJsonAsync, buildRegionArgs, resolveRegion } from "../../utils/aws.js";
import { createBackStackHelpers } from "../../adapters/backStackUtils.js";
import { atom, getDefaultStore } from "jotai";
import type { AwsSNSTopic, AwsSNSTopicAttributes, AwsSNSSubscription, SNSLevel, SNSRowMeta } from "./types.js";
import { createSNSDetailCapability } from "./capabilities/detailCapability.js";
import { createSNSYankCapability } from "./capabilities/yankCapability.js";
import { createSNSActionCapability } from "./capabilities/actionCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";

interface SNSNavFrame extends NavFrame {
  level: SNSLevel;
}

export const snsLevelAtom = atom<SNSLevel>({ kind: "topics" });
export const snsBackStackAtom = atom<SNSNavFrame[]>([]);

function topicNameFromArn(arn: string): string {
  return arn.split(":").pop() ?? arn;
}

export function createSNSServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const store = getDefaultStore();
  const regionArgs = buildRegionArgs(region);

  const getLevel = () => store.get(snsLevelAtom);
  const setLevel = (level: SNSLevel) => store.set(snsLevelAtom, level);
  const getBackStack = () => store.get(snsBackStackAtom);
  const setBackStack = (stack: SNSNavFrame[]) => store.set(snsBackStackAtom, stack);

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "topics") {
      return [
        { key: "name", label: "Name" },
        { key: "confirmed", label: "Confirmed", width: 12 },
        { key: "pending", label: "Pending", width: 10 },
        { key: "fifo", label: "FIFO", width: 6 },
        { key: "arn", label: "ARN" },
      ];
    }
    // subscriptions level
    return [
      { key: "protocol", label: "Protocol", width: 10 },
      { key: "endpoint", label: "Endpoint" },
      { key: "status", label: "Status", width: 22 },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "topics") {
      try {
        const listData = await runAwsJsonAsync<{ Topics: AwsSNSTopic[] }>([
          "sns",
          "list-topics",
          ...regionArgs,
        ]);
        const topics = listData.Topics ?? [];
        if (topics.length === 0) return [];

        const attrResults = await Promise.allSettled(
          topics.map((topic) =>
            runAwsJsonAsync<{ Attributes: AwsSNSTopicAttributes }>([
              "sns",
              "get-topic-attributes",
              "--topic-arn",
              topic.TopicArn,
              ...regionArgs,
            ]),
          ),
        );

        return topics.map((topic, i) => {
          const topicName = topicNameFromArn(topic.TopicArn);
          let confirmed = "-";
          let pending = "-";
          let fifo = "No";

          const result = attrResults[i]!;
          if (result.status === "fulfilled") {
            const attrs = result.value.Attributes ?? {};
            confirmed = attrs.SubscriptionsConfirmed ?? "-";
            pending = attrs.SubscriptionsPending ?? "-";
            fifo = attrs.FifoTopic === "true" ? "Yes" : "No";
          }

          return {
            id: topic.TopicArn,
            cells: {
              name: textCell(topicName),
              confirmed: textCell(confirmed),
              pending: textCell(pending),
              fifo: textCell(fifo),
              arn: textCell(topic.TopicArn),
            },
            meta: {
              type: "topic",
              topicArn: topic.TopicArn,
              topicName,
            } satisfies SNSRowMeta,
          };
        });
      } catch (e) {
        debugLog("sns", "getRows (topics) failed", e);
        return [];
      }
    }

    // subscriptions level
    const { topicArn } = level;
    try {
      const data = await runAwsJsonAsync<{ Subscriptions: AwsSNSSubscription[] }>([
        "sns",
        "list-subscriptions-by-topic",
        "--topic-arn",
        topicArn,
        ...regionArgs,
      ]);

      return (data.Subscriptions ?? []).map((sub) => {
        // Status is implicit: if SubscriptionArn is "PendingConfirmation" it's pending
        const status = sub.SubscriptionArn === "PendingConfirmation"
          ? "PendingConfirmation"
          : "Confirmed";
        return {
          id: sub.SubscriptionArn === "PendingConfirmation"
            ? `${topicArn}/${sub.Protocol}/${sub.Endpoint}`
            : sub.SubscriptionArn,
          cells: {
            protocol: textCell(sub.Protocol),
            endpoint: textCell(sub.Endpoint || "-"),
            status: statusCell(status),
          },
          meta: {
            type: "subscription",
            subscriptionArn: sub.SubscriptionArn,
            topicArn,
            protocol: sub.Protocol,
            endpoint: sub.Endpoint || "",
          } satisfies SNSRowMeta,
        };
      });
    } catch (e) {
      debugLog("sns", "getRows (subscriptions) failed", e);
      return [];
    }
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    const meta = row.meta as SNSRowMeta | undefined;

    if (level.kind === "topics") {
      if (!meta || meta.type !== "topic") return { action: "none" };

      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({ kind: "subscriptions", topicArn: meta.topicArn, topicName: meta.topicName });
      return { action: "navigate" };
    }

    // subscriptions level: leaf
    return { action: "none" };
  };

  const { canGoBack, goBack } = createBackStackHelpers(getLevel, setLevel, getBackStack, setBackStack);

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "topics") return "sns://";
    return `sns://${level.topicName}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "topics") return "📣 SNS Topics";
    return `📣 ${level.topicName}`;
  };

  const detailCapability = createSNSDetailCapability(region, getLevel);
  const yankCapability = createSNSYankCapability();
  const actionCapability = createSNSActionCapability(region, getLevel);

  const getRelatedResources = async (row: TableRow): Promise<RelatedResource[]> => {
    const level = getLevel();
    if (level.kind !== "topics") return [];
    const meta = row.meta as SNSRowMeta | undefined;
    if (!meta || meta.type !== "topic") return [];

    try {
      const data = await runAwsJsonAsync<{
        Subscriptions: Array<{ Protocol: string; Endpoint: string; SubscriptionArn: string }>;
      }>([
        "sns",
        "list-subscriptions-by-topic",
        "--topic-arn",
        meta.topicArn,
        ...regionArgs,
      ]);

      const results: RelatedResource[] = [];
      for (const sub of data.Subscriptions ?? []) {
        if (sub.Protocol === "sqs") {
          const name = sub.Endpoint.split(":").pop() ?? sub.Endpoint;
          results.push({ serviceId: "sqs", label: `SQS: ${name}`, filterHint: name });
        } else if (sub.Protocol === "lambda") {
          const name = sub.Endpoint.split(":function:")[1] ?? sub.Endpoint.split(":").pop() ?? sub.Endpoint;
          results.push({ serviceId: "lambda", label: `Lambda: ${name}`, filterHint: name });
        }
      }
      return results;
    } catch {
      return [];
    }
  };

  const getBrowserUrl = (row: TableRow): string | null => {
    const r = resolveRegion(region);
    const meta = row.meta as SNSRowMeta | undefined;
    if (!meta) return null;
    if (meta.type === "topic") {
      return `https://${r}.console.aws.amazon.com/sns/v3/home?region=${r}#/topic/${encodeURIComponent(meta.topicArn)}`;
    }
    return null;
  };

  return {
    id: "sns",
    label: "SNS",
    hudColor: SERVICE_COLORS.sns ?? { bg: "magenta", fg: "white" },
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    getPath,
    getContextLabel,
    getRelatedResources,
    getBrowserUrl,
    reset() {
      setLevel({ kind: "topics" });
      setBackStack([]);
    },
    capabilities: {
      detail: detailCapability,
      yank: yankCapability,
      actions: actionCapability,
    },
  };
}
