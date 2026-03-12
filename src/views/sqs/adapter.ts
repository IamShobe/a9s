import type { ServiceAdapter, RelatedResource } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../utils/aws.js";
import { createBackStackHelpers } from "../../adapters/backStackUtils.js";
import { atom, getDefaultStore } from "jotai";
import type { AwsSQSQueueAttributes, AwsSQSMessage, SQSLevel, SQSRowMeta } from "./types.js";
import { createSQSDetailCapability } from "./capabilities/detailCapability.js";
import { createSQSYankCapability } from "./capabilities/yankCapability.js";
import { createSQSEditCapability } from "./capabilities/editCapability.js";
import { createSQSActionCapability } from "./capabilities/actionCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";

interface SQSNavFrame extends NavFrame {
  level: SQSLevel;
}

export const sqsLevelAtom = atom<SQSLevel>({ kind: "queues" });
export const sqsBackStackAtom = atom<SQSNavFrame[]>([]);

function queueNameFromUrl(url: string): string {
  return url.split("/").pop() ?? url;
}

export function createSQSServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const store = getDefaultStore();
  const regionArgs = buildRegionArgs(region);

  const getLevel = () => store.get(sqsLevelAtom);
  const setLevel = (level: SQSLevel) => store.set(sqsLevelAtom, level);
  const getBackStack = () => store.get(sqsBackStackAtom);
  const setBackStack = (stack: SQSNavFrame[]) => store.set(sqsBackStackAtom, stack);

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "queues") {
      return [
        { key: "name", label: "Name", width: 36 },
        { key: "type", label: "Type", width: 10 },
        { key: "messages", label: "Messages", width: 12 },
        { key: "inflight", label: "In-Flight", width: 12 },
        { key: "created", label: "Created" },
      ];
    }
    // messages level
    return [
      { key: "messageId", label: "Message ID", width: 40 },
      { key: "body", label: "Body", width: 52 },
      { key: "sent", label: "Sent", width: 22 },
      { key: "size", label: "Size", width: 8 },
      { key: "receiveCount", label: "Rcv Count" },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "queues") {
      try {
        const listData = await runAwsJsonAsync<{ QueueUrls?: string[] }>([
          "sqs",
          "list-queues",
          ...regionArgs,
        ]);

        const urls = listData.QueueUrls ?? [];
        if (urls.length === 0) return [];

        const rows: TableRow[] = [];
        for (const url of urls) {
          try {
            const attrData = await runAwsJsonAsync<{ Attributes: AwsSQSQueueAttributes }>([
              "sqs",
              "get-queue-attributes",
              "--queue-url",
              url,
              "--attribute-names",
              "All",
              ...regionArgs,
            ]);
            const attrs = attrData.Attributes ?? {};
            const name = queueNameFromUrl(url);
            const isFifo = attrs.FifoQueue === "true" || name.endsWith(".fifo");
            const createdTs = attrs.CreatedTimestamp;
            const createdDisplay = createdTs
              ? new Date(Number(createdTs) * 1000).toISOString().slice(0, 10)
              : "-";

            rows.push({
              id: url,
              cells: {
                name: textCell(name),
                type: textCell(isFifo ? "FIFO" : "Standard"),
                messages: textCell(attrs.ApproximateNumberOfMessages ?? "-"),
                inflight: textCell(attrs.ApproximateNumberOfMessagesNotVisible ?? "-"),
                created: textCell(createdDisplay),
              },
              meta: {
                type: "queue",
                queueUrl: url,
                queueArn: attrs.QueueArn ?? "",
                queueName: name,
                isFifo,
              } satisfies SQSRowMeta,
            });
          } catch (e) {
            debugLog("sqs", `getRows: failed to get attrs for ${url}`, e);
          }
        }
        return rows;
      } catch (e) {
        debugLog("sqs", "getRows (queues) failed", e);
        return [];
      }
    }

    // messages level — peek with visibility-timeout=0
    const { queueUrl, queueName } = level;
    try {
      const data = await runAwsJsonAsync<{ Messages?: AwsSQSMessage[] }>([
        "sqs",
        "receive-message",
        "--queue-url",
        queueUrl,
        "--max-number-of-messages",
        "10",
        "--visibility-timeout",
        "0",
        "--attribute-names",
        "All",
        ...regionArgs,
      ]);

      return (data.Messages ?? []).map((msg) => {
        const bodyPreview = (msg.Body ?? "").slice(0, 50) + ((msg.Body?.length ?? 0) > 50 ? "..." : "");
        const sentTs = msg.Attributes?.SentTimestamp;
        const sentDisplay = sentTs
          ? new Date(Number(sentTs)).toISOString().slice(0, 19).replace("T", " ")
          : "-";
        const size = msg.Body ? String(Buffer.byteLength(msg.Body, "utf8")) + "B" : "-";

        return {
          id: msg.MessageId,
          cells: {
            messageId: textCell(msg.MessageId),
            body: textCell(bodyPreview),
            sent: textCell(sentDisplay),
            size: textCell(size),
            receiveCount: textCell(msg.Attributes?.ApproximateReceiveCount ?? "-"),
          },
          meta: {
            type: "message",
            messageId: msg.MessageId,
            receiptHandle: msg.ReceiptHandle,
            queueUrl,
          } satisfies SQSRowMeta,
        };
      });
    } catch (e) {
      debugLog("sqs", `getRows (messages for ${queueName}) failed`, e);
      return [];
    }
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    const meta = row.meta as SQSRowMeta | undefined;

    if (level.kind === "queues") {
      if (!meta || meta.type !== "queue") return { action: "none" };

      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({ kind: "messages", queueUrl: meta.queueUrl, queueName: meta.queueName });
      return { action: "navigate" };
    }

    // messages level: leaf
    return { action: "none" };
  };

  const { canGoBack, goBack } = createBackStackHelpers(getLevel, setLevel, getBackStack, setBackStack);

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "queues") return "sqs://";
    return `sqs://${level.queueName}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "queues") return "📬 SQS Queues";
    return `📬 ${level.queueName}`;
  };

  const detailCapability = createSQSDetailCapability(region, getLevel);
  const yankCapability = createSQSYankCapability();
  const editCapability = createSQSEditCapability(region, getLevel);
  const actionCapability = createSQSActionCapability(region, getLevel);

  const getRelatedResources = (row: TableRow): RelatedResource[] => {
    const meta = row.meta as SQSRowMeta | undefined;
    if (!meta || meta.type !== "queue") return [];
    const queueName = meta.queueName;
    const resources: RelatedResource[] = [
      {
        serviceId: "cloudwatch",
        label: `CloudWatch metrics for ${queueName}`,
        filterHint: queueName,
      },
      {
        serviceId: "sns",
        label: "SNS topics (find subscribed topic)",
      },
    ];
    return resources;
  };

  const getBrowserUrl = (row: TableRow): string | null => {
    const r = region ?? "us-east-1";
    const meta = row.meta as SQSRowMeta | undefined;
    if (!meta) return null;
    if (meta.type === "queue") {
      return `https://${r}.console.aws.amazon.com/sqs/v3/home?region=${r}#/queues/${encodeURIComponent(meta.queueUrl)}`;
    }
    return null;
  };

  return {
    id: "sqs",
    label: "SQS",
    hudColor: SERVICE_COLORS.sqs ?? { bg: "green", fg: "black" },
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
      setLevel({ kind: "queues" });
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
