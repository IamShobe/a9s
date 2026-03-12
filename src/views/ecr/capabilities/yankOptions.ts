import { z } from "zod";
import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import { ECRRowMetaSchema } from "../schema.js";

type ECRMeta = z.infer<typeof ECRRowMetaSchema>;

export const ECRYankOptions: YankOptionDef<ECRMeta, Record<string, never>>[] = [
  // Repository options
  {
    trigger: { type: "key", char: "n" },
    label: "Copy repository name",
    feedback: "Copied repository name",
    isRelevant: (row) => row.meta.type === "repository",
    resolve: async (row) => row.meta.repositoryName ?? null,
  },
  {
    trigger: { type: "key", char: "u" },
    label: "Copy repository URI",
    feedback: "Copied repository URI",
    isRelevant: (row) => row.meta.type === "repository",
    resolve: async (row) => row.meta.repositoryUri ?? null,
  },
  {
    trigger: { type: "key", char: "a" },
    label: "Copy ARN",
    feedback: "Copied ARN",
    isRelevant: (row) => row.meta.type === "repository",
    resolve: async (row) => row.meta.repositoryArn ?? null,
  },
  // Image options
  {
    trigger: { type: "key", char: "u" },
    label: "Copy image URI",
    feedback: "Copied image URI",
    isRelevant: (row) => row.meta.type === "image" && Boolean(row.meta.imageTag),
    resolve: async (row) =>
      row.meta.repositoryUri && row.meta.imageTag
        ? `${row.meta.repositoryUri}:${row.meta.imageTag}`
        : null,
  },
  {
    trigger: { type: "key", char: "d" },
    label: "Copy image digest",
    feedback: "Copied digest",
    isRelevant: (row) => row.meta.type === "image",
    resolve: async (row) => row.meta.imageDigest ?? null,
  },
  {
    trigger: { type: "key", char: "r" },
    label: "Copy digest URI",
    feedback: "Copied digest URI",
    isRelevant: (row) => row.meta.type === "image",
    resolve: async (row) =>
      row.meta.repositoryUri && row.meta.imageDigest
        ? `${row.meta.repositoryUri}@${row.meta.imageDigest}`
        : null,
  },
];
