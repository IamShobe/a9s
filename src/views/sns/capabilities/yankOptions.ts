import { z } from "zod";
import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import { SNSRowMetaSchema } from "../schema.js";

type SNSMeta = z.infer<typeof SNSRowMetaSchema>;

export const SNSYankOptions: YankOptionDef<SNSMeta, Record<string, never>>[] = [
  // Topic options
  {
    trigger: { type: "key", char: "n" },
    label: "Copy topic name",
    feedback: "Copied topic name",
    isRelevant: (row) => row.meta.type === "topic",
    resolve: async (row) => row.meta.topicName ?? null,
  },
  {
    trigger: { type: "key", char: "a" },
    label: "Copy topic ARN",
    feedback: "Copied topic ARN",
    isRelevant: (row) => row.meta.type === "topic",
    resolve: async (row) => row.meta.topicArn ?? null,
  },
  // Subscription options
  {
    trigger: { type: "key", char: "e" },
    label: "Copy endpoint",
    feedback: "Copied endpoint",
    isRelevant: (row) => row.meta.type === "subscription",
    resolve: async (row) => row.meta.endpoint ?? null,
  },
  {
    trigger: { type: "key", char: "a" },
    label: "Copy subscription ARN",
    feedback: "Copied subscription ARN",
    isRelevant: (row) => row.meta.type === "subscription",
    resolve: async (row) => row.meta.subscriptionArn ?? null,
  },
];
