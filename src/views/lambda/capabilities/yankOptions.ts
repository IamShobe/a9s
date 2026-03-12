import { z } from "zod";
import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import { LambdaRowMetaSchema } from "../schema.js";

type LambdaMeta = z.infer<typeof LambdaRowMetaSchema>;

export const LambdaYankOptions: YankOptionDef<LambdaMeta, Record<string, never>>[] = [
  // Function options
  {
    trigger: { type: "key", char: "n" },
    label: "Copy function name",
    feedback: "Copied function name",
    isRelevant: (row) => row.meta.type === "function",
    resolve: async (row) => row.meta.functionName ?? null,
  },
  {
    trigger: { type: "key", char: "a" },
    label: "Copy function ARN",
    feedback: "Copied function ARN",
    isRelevant: (row) => row.meta.type === "function",
    resolve: async (row) => row.meta.functionArn ?? null,
  },
  {
    trigger: { type: "key", char: "r" },
    label: "Copy runtime",
    feedback: "Copied runtime",
    isRelevant: (row) => row.meta.type === "function",
    resolve: async (row) => row.meta.runtime ?? null,
  },
  {
    trigger: { type: "key", char: "c" },
    label: "Copy invoke CLI command",
    feedback: "Copied invoke command",
    isRelevant: (row) => row.meta.type === "function",
    resolve: async (row) => {
      if (!row.meta.functionName) return null;
      return `aws lambda invoke --function-name ${row.meta.functionName} --payload '{}' /tmp/response.json`;
    },
  },
  // Version options
  {
    trigger: { type: "key", char: "a" },
    label: "Copy version ARN",
    feedback: "Copied version ARN",
    isRelevant: (row) => row.meta.type === "version",
    resolve: async (row) => row.meta.functionArn ?? null,
  },
  {
    trigger: { type: "key", char: "v" },
    label: "Copy version",
    feedback: "Copied version",
    isRelevant: (row) => row.meta.type === "version",
    resolve: async (row) => row.meta.version ?? null,
  },
];
