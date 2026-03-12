import { z } from "zod";
import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import { SQSRowMetaSchema } from "../schema.js";

type SQSMeta = z.infer<typeof SQSRowMetaSchema>;

export const SQSYankOptions: YankOptionDef<SQSMeta, Record<string, never>>[] = [
  // Queue options
  {
    trigger: { type: "key", char: "n" },
    label: "Copy queue name",
    feedback: "Copied queue name",
    isRelevant: (row) => row.meta.type === "queue",
    resolve: async (row) => row.meta.queueName ?? null,
  },
  {
    trigger: { type: "key", char: "u" },
    label: "Copy queue URL",
    feedback: "Copied queue URL",
    isRelevant: (row) => row.meta.type === "queue",
    resolve: async (row) => row.meta.queueUrl ?? null,
  },
  {
    trigger: { type: "key", char: "a" },
    label: "Copy ARN",
    feedback: "Copied ARN",
    isRelevant: (row) => row.meta.type === "queue",
    resolve: async (row) => row.meta.queueArn ?? null,
  },
  // Message options
  {
    trigger: { type: "key", char: "i" },
    label: "Copy message ID",
    feedback: "Copied message ID",
    isRelevant: (row) => row.meta.type === "message",
    resolve: async (row) => row.meta.messageId ?? null,
  },
  {
    trigger: { type: "key", char: "b" },
    label: "Copy body",
    feedback: "Copied body",
    isRelevant: (row) => row.meta.type === "message",
    resolve: async (row) => row.cells["body"]?.displayName ?? null,
  },
];
