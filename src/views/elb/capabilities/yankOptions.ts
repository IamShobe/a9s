import { z } from "zod";
import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import { ELBRowMetaSchema } from "../schema.js";

type ELBMeta = z.infer<typeof ELBRowMetaSchema>;

export const ELBYankOptions: YankOptionDef<ELBMeta, Record<string, never>>[] = [
  // Load balancer options
  {
    trigger: { type: "key", char: "n" },
    label: "Copy LB name",
    feedback: "Copied LB name",
    isRelevant: (row) => row.meta.type === "load-balancer",
    resolve: async (row) => row.meta.lbName ?? null,
  },
  {
    trigger: { type: "key", char: "a" },
    label: "Copy LB ARN",
    feedback: "Copied LB ARN",
    isRelevant: (row) => row.meta.type === "load-balancer",
    resolve: async (row) => row.meta.lbArn ?? null,
  },
  {
    trigger: { type: "key", char: "d" },
    label: "Copy DNS name",
    feedback: "Copied DNS name",
    isRelevant: (row) => row.meta.type === "load-balancer",
    resolve: async (row) => row.meta.dnsName ?? null,
  },
  // Target group options
  {
    trigger: { type: "key", char: "n" },
    label: "Copy target group name",
    feedback: "Copied target group name",
    isRelevant: (row) => row.meta.type === "target-group",
    resolve: async (row) => row.meta.tgName ?? null,
  },
  {
    trigger: { type: "key", char: "a" },
    label: "Copy target group ARN",
    feedback: "Copied target group ARN",
    isRelevant: (row) => row.meta.type === "target-group",
    resolve: async (row) => row.meta.tgArn ?? null,
  },
  // Target options
  {
    trigger: { type: "key", char: "i" },
    label: "Copy target ID",
    feedback: "Copied target ID",
    isRelevant: (row) => row.meta.type === "target",
    resolve: async (row) => row.meta.targetId ?? null,
  },
];
