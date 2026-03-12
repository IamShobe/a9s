import { z } from "zod";
import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import { EventBridgeRowMetaSchema } from "../schema.js";

type EventBridgeMeta = z.infer<typeof EventBridgeRowMetaSchema>;

export const EventBridgeYankOptions: YankOptionDef<EventBridgeMeta, Record<string, never>>[] = [
  // Bus options
  {
    trigger: { type: "key", char: "n" },
    label: "Copy bus name",
    feedback: "Copied bus name",
    isRelevant: (row) => row.meta.type === "bus",
    resolve: async (row) => row.meta.busName ?? null,
  },
  {
    trigger: { type: "key", char: "a" },
    label: "Copy ARN",
    feedback: "Copied ARN",
    isRelevant: (row) => row.meta.type === "bus",
    resolve: async (row) => row.meta.busArn ?? null,
  },
  // Rule options
  {
    trigger: { type: "key", char: "n" },
    label: "Copy rule name",
    feedback: "Copied rule name",
    isRelevant: (row) => row.meta.type === "rule",
    resolve: async (row) => row.meta.ruleName ?? null,
  },
  {
    trigger: { type: "key", char: "a" },
    label: "Copy ARN",
    feedback: "Copied ARN",
    isRelevant: (row) => row.meta.type === "rule",
    resolve: async (row) => row.meta.ruleArn ?? null,
  },
  {
    trigger: { type: "key", char: "b" },
    label: "Copy bus name",
    feedback: "Copied bus name",
    isRelevant: (row) => row.meta.type === "rule",
    resolve: async (row) => row.meta.busName ?? null,
  },
];
