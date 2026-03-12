import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { AwsSQSQueueAttributes, SQSLevel, SQSRowMeta } from "../types.js";
import { debugLog } from "../../../utils/debugLogger.js";

export function createSQSDetailCapability(
  region?: string,
  getLevel?: () => SQSLevel,
): DetailCapability {
  const regionArgs = buildRegionArgs(region);

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as SQSRowMeta | undefined;
    if (!meta) return [];

    const level = getLevel?.();

    if (level?.kind === "queues" && meta.type === "queue") {
      try {
        const data = await runAwsJsonAsync<{ Attributes: AwsSQSQueueAttributes }>([
          "sqs",
          "get-queue-attributes",
          "--queue-url",
          meta.queueUrl,
          "--attribute-names",
          "All",
          ...regionArgs,
        ]);
        const attrs = data.Attributes ?? {};

        const fields: DetailField[] = [
          { label: "Name", value: meta.queueName },
          { label: "URL", value: meta.queueUrl },
          { label: "ARN", value: attrs.QueueArn ?? meta.queueArn },
          { label: "Type", value: meta.isFifo ? "FIFO" : "Standard" },
          { label: "Messages", value: attrs.ApproximateNumberOfMessages ?? "-" },
          { label: "In-Flight", value: attrs.ApproximateNumberOfMessagesNotVisible ?? "-" },
          { label: "Visibility Timeout", value: attrs.VisibilityTimeout ? `${attrs.VisibilityTimeout}s` : "-" },
          { label: "Retention Period", value: attrs.MessageRetentionPeriod ? `${attrs.MessageRetentionPeriod}s` : "-" },
          { label: "Delay Seconds", value: attrs.DelaySeconds ?? "-" },
          { label: "Receive Wait Time", value: attrs.ReceiveMessageWaitTimeSeconds ? `${attrs.ReceiveMessageWaitTimeSeconds}s` : "-" },
          { label: "Created", value: attrs.CreatedTimestamp ? new Date(Number(attrs.CreatedTimestamp) * 1000).toISOString().slice(0, 19).replace("T", " ") : "-" },
          { label: "Last Modified", value: attrs.LastModifiedTimestamp ? new Date(Number(attrs.LastModifiedTimestamp) * 1000).toISOString().slice(0, 19).replace("T", " ") : "-" },
        ];

        if (attrs.RedrivePolicy) {
          fields.push({ label: "Redrive Policy", value: attrs.RedrivePolicy });
        }

        return fields;
      } catch (e) {
        debugLog("sqs", "getDetails (queue) failed", e);
        return [];
      }
    }

    if (level?.kind === "messages" && meta.type === "message") {
      return [
        { label: "Message ID", value: meta.messageId },
        { label: "Queue URL", value: meta.queueUrl },
        { label: "Receipt Handle", value: meta.receiptHandle.slice(0, 60) + "..." },
        { label: "Body", value: row.cells["body"]?.displayName ?? "-" },
      ];
    }

    return [];
  };

  return { getDetails };
}
