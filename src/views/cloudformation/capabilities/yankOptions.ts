import { z } from "zod";
import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import { CloudFormationRowMetaSchema } from "../schema.js";

type CFMeta = z.infer<typeof CloudFormationRowMetaSchema>;

export const CloudFormationYankOptions: YankOptionDef<CFMeta, Record<string, never>>[] = [
  // Stack options
  {
    trigger: { type: "key", char: "n" },
    label: "Copy stack name",
    feedback: "Copied stack name",
    isRelevant: (row) => row.meta.type === "stack",
    resolve: async (row) => row.meta.stackName ?? null,
  },
  {
    trigger: { type: "key", char: "a" },
    label: "Copy stack ARN",
    feedback: "Copied stack ARN",
    isRelevant: (row) => row.meta.type === "stack",
    resolve: async (row) => row.meta.stackId ?? null,
  },
  // Resource options
  {
    trigger: { type: "key", char: "l" },
    label: "Copy logical ID",
    feedback: "Copied logical ID",
    isRelevant: (row) => row.meta.type === "resource",
    resolve: async (row) => row.meta.logicalResourceId ?? null,
  },
  {
    trigger: { type: "key", char: "p" },
    label: "Copy physical ID",
    feedback: "Copied physical ID",
    isRelevant: (row) => row.meta.type === "resource",
    resolve: async (row) => row.meta.physicalResourceId ?? null,
  },
  {
    trigger: { type: "key", char: "t" },
    label: "Copy resource type",
    feedback: "Copied resource type",
    isRelevant: (row) => row.meta.type === "resource",
    resolve: async (row) => row.meta.resourceType ?? null,
  },
];
