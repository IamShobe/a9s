import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { AwsSNSTopicAttributes, SNSLevel, SNSRowMeta } from "../types.js";
import { debugLog } from "../../../utils/debugLogger.js";

export function createSNSDetailCapability(
  region?: string,
  getLevel?: () => SNSLevel,
): DetailCapability {
  const regionArgs = buildRegionArgs(region);

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as SNSRowMeta | undefined;
    if (!meta) return [];

    const level = getLevel?.();

    if (level?.kind === "topics" && meta.type === "topic") {
      try {
        const data = await runAwsJsonAsync<{ Attributes: AwsSNSTopicAttributes }>([
          "sns",
          "get-topic-attributes",
          "--topic-arn",
          meta.topicArn,
          ...regionArgs,
        ]);
        const attrs = data.Attributes ?? {};
        return [
          { label: "Name", value: meta.topicName },
          { label: "ARN", value: meta.topicArn },
          { label: "Display Name", value: attrs.DisplayName || "-" },
          { label: "Owner", value: attrs.Owner ?? "-" },
          { label: "Subscriptions (Confirmed)", value: attrs.SubscriptionsConfirmed ?? "-" },
          { label: "Subscriptions (Pending)", value: attrs.SubscriptionsPending ?? "-" },
          { label: "Subscriptions (Deleted)", value: attrs.SubscriptionsDeleted ?? "-" },
          { label: "FIFO", value: attrs.FifoTopic === "true" ? "Yes" : "No" },
          { label: "KMS Key", value: attrs.KmsMasterKeyId || "-" },
        ];
      } catch (e) {
        debugLog("sns", "getDetails (topic) failed", e);
        return [];
      }
    }

    if (level?.kind === "subscriptions" && meta.type === "subscription") {
      return [
        { label: "Subscription ARN", value: meta.subscriptionArn },
        { label: "Topic ARN", value: meta.topicArn },
        { label: "Protocol", value: meta.protocol },
        { label: "Endpoint", value: meta.endpoint },
      ];
    }

    return [];
  };

  return { getDetails };
}
