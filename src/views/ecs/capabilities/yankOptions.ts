import { z } from "zod";
import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import { ECSRowMetaSchema } from "../schema.js";

type ECSMeta = z.infer<typeof ECSRowMetaSchema>;

export const ECSYankOptions: YankOptionDef<ECSMeta, Record<string, never>>[] = [
  // Cluster options
  {
    trigger: { type: "key", char: "a" },
    label: "Copy cluster ARN",
    feedback: "Copied cluster ARN",
    isRelevant: (row) => row.meta.type === "cluster",
    resolve: async (row) => row.meta.clusterArn ?? null,
  },
  {
    trigger: { type: "key", char: "n" },
    label: "Copy cluster name",
    feedback: "Copied cluster name",
    isRelevant: (row) => row.meta.type === "cluster",
    resolve: async (row) => row.meta.clusterName ?? null,
  },
  // Service options
  {
    trigger: { type: "key", char: "a" },
    label: "Copy service ARN",
    feedback: "Copied service ARN",
    isRelevant: (row) => row.meta.type === "service",
    resolve: async (row) => row.meta.serviceArn ?? null,
  },
  {
    trigger: { type: "key", char: "n" },
    label: "Copy service name",
    feedback: "Copied service name",
    isRelevant: (row) => row.meta.type === "service",
    resolve: async (row) => row.meta.serviceName ?? null,
  },
  // Task options
  {
    trigger: { type: "key", char: "a" },
    label: "Copy task ARN",
    feedback: "Copied task ARN",
    isRelevant: (row) => row.meta.type === "task",
    resolve: async (row) => row.meta.taskArn ?? null,
  },
  {
    trigger: { type: "key", char: "i" },
    label: "Copy task ID",
    feedback: "Copied task ID",
    isRelevant: (row) => row.meta.type === "task",
    resolve: async (row) => row.meta.taskId ?? null,
  },
];
