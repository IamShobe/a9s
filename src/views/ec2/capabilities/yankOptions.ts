import { z } from "zod";
import type { YankOptionDef } from "../../../adapters/capabilities/YankCapability.js";
import { EC2RowMetaSchema } from "../schema.js";

type EC2Meta = z.infer<typeof EC2RowMetaSchema>;

export const EC2YankOptions: YankOptionDef<EC2Meta, Record<string, never>>[] = [
  // Instance options
  {
    trigger: { type: "key", char: "i" },
    label: "Copy instance ID",
    feedback: "Copied instance ID",
    isRelevant: (row) => row.meta.type === "instance",
    resolve: async (row) => row.meta.instanceId ?? null,
  },
  {
    trigger: { type: "key", char: "n" },
    label: "Copy instance name",
    feedback: "Copied instance name",
    isRelevant: (row) => row.meta.type === "instance",
    resolve: async (row) => row.meta.instanceName ?? null,
  },
  {
    trigger: { type: "key", char: "p" },
    label: "Copy public IP",
    feedback: "Copied public IP",
    isRelevant: (row) => row.meta.type === "instance" && Boolean(row.meta.publicIp),
    resolve: async (row) => row.meta.publicIp ?? null,
  },
  {
    trigger: { type: "key", char: "r" },
    label: "Copy private IP",
    feedback: "Copied private IP",
    isRelevant: (row) => row.meta.type === "instance",
    resolve: async (row) => row.meta.privateIp ?? null,
  },
  // Volume options
  {
    trigger: { type: "key", char: "i" },
    label: "Copy volume ID",
    feedback: "Copied volume ID",
    isRelevant: (row) => row.meta.type === "volume",
    resolve: async (row) => row.meta.volumeId ?? null,
  },
];
