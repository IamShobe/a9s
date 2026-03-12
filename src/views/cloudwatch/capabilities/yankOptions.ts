import { z } from "zod";
import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import { CloudWatchRowMetaSchema } from "../schema.js";

type CWMeta = z.infer<typeof CloudWatchRowMetaSchema>;

export const CloudWatchYankOptions: YankOptionDef<CWMeta, Record<string, never>>[] = [
  // Log group options
  {
    trigger: { type: "key", char: "n" },
    label: "Copy log group name",
    feedback: "Copied log group name",
    isRelevant: (row) => row.meta.type === "log-group",
    resolve: async (row) => row.meta.logGroupName ?? null,
  },
  {
    trigger: { type: "key", char: "a" },
    label: "Copy log group ARN",
    feedback: "Copied log group ARN",
    isRelevant: (row) => row.meta.type === "log-group",
    resolve: async (row) => row.meta.logGroupArn ?? null,
  },
  // Log stream options
  {
    trigger: { type: "key", char: "n" },
    label: "Copy log stream name",
    feedback: "Copied log stream name",
    isRelevant: (row) => row.meta.type === "log-stream",
    resolve: async (row) => row.meta.logStreamName ?? null,
  },
  // Log event options
  {
    trigger: { type: "key", char: "m" },
    label: "Copy message",
    feedback: "Copied message",
    isRelevant: (row) => row.meta.type === "log-event",
    resolve: async (row) => row.meta.message ?? null,
  },
];
