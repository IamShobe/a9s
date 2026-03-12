import { z } from "zod";
import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import { VPCRowMetaSchema } from "../schema.js";

type VPCMeta = z.infer<typeof VPCRowMetaSchema>;

export const VPCYankOptions: YankOptionDef<VPCMeta, Record<string, never>>[] = [
  // VPC options
  {
    trigger: { type: "key", char: "v" },
    label: "Copy VPC ID",
    feedback: "Copied VPC ID",
    isRelevant: (row) => row.meta.type === "vpc",
    resolve: async (row) => row.meta.vpcId ?? null,
  },
  {
    trigger: { type: "key", char: "c" },
    label: "Copy CIDR block",
    feedback: "Copied CIDR",
    isRelevant: (row) => row.meta.type === "vpc",
    resolve: async (row) => row.meta.cidr ?? null,
  },
  // Security Group options
  {
    trigger: { type: "key", char: "i" },
    label: "Copy SG ID",
    feedback: "Copied SG ID",
    isRelevant: (row) => row.meta.type === "security-group",
    resolve: async (row) => row.meta.sgId ?? null,
  },
  {
    trigger: { type: "key", char: "n" },
    label: "Copy SG name",
    feedback: "Copied SG name",
    isRelevant: (row) => row.meta.type === "security-group",
    resolve: async (row) => row.meta.sgName ?? null,
  },
  // Rule options
  {
    trigger: { type: "key", char: "s" },
    label: "Copy source/dest",
    feedback: "Copied source/destination",
    isRelevant: (row) => row.meta.type === "rule",
    resolve: async (row) => row.meta.sourceDest ?? null,
  },
];
