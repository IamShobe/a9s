import { z } from "zod";
import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import { CloudFrontRowMetaSchema } from "../schema.js";

type CloudFrontMeta = z.infer<typeof CloudFrontRowMetaSchema>;

export const CloudFrontYankOptions: YankOptionDef<CloudFrontMeta, Record<string, never>>[] = [
  // Distribution options
  {
    trigger: { type: "key", char: "d" },
    label: "Copy distribution ID",
    feedback: "Copied distribution ID",
    isRelevant: (row) => row.meta.type === "distribution",
    resolve: async (row) => row.meta.distributionId ?? null,
  },
  {
    trigger: { type: "key", char: "o" },
    label: "Copy domain name",
    feedback: "Copied domain name",
    isRelevant: (row) => row.meta.type === "distribution",
    resolve: async (row) => row.meta.domainName ?? null,
  },
  {
    trigger: { type: "key", char: "a" },
    label: "Copy distribution ARN",
    feedback: "Copied distribution ARN",
    isRelevant: (row) => row.meta.type === "distribution",
    resolve: async (row) => row.meta.arn ?? null,
  },
  // Invalidation options
  {
    trigger: { type: "key", char: "i" },
    label: "Copy invalidation ID",
    feedback: "Copied invalidation ID",
    isRelevant: (row) => row.meta.type === "invalidation",
    resolve: async (row) => row.meta.invalidationId ?? null,
  },
];
